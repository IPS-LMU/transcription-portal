import { HttpClient } from '@angular/common/http';
import { PartiturConverter, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { joinURL, stringifyQueryParams, wait } from '@octra/utilities';
import { downloadFile, readFileContents } from '@octra/web-media';
import { interval } from 'rxjs';
import * as UUID from 'uuid';
import { AppSettings } from '../../shared/app.settings';
import { Task, TaskStatus } from '../tasks';
import { TPortalAudioInfo, TPortalFileInfo } from '../TPortalFileInfoAttributes';
import { IOperation, Operation, OperationOptions, OperationProcessingRound } from './operation';

export interface ISummarizationOperation extends IOperation {
  language?: string;
  maxNumberOfWords?: number;
}

export class SummarizationOperation extends Operation {
  public resultType = 'Text';
  protected _language?: string;
  get language(): string | undefined {
    return this._language;
  }

  set language(value: string | undefined) {
    this._language = value;
  }
  maxNumberOfWords?: number;

  public start = async (inputs: (TPortalFileInfo | TPortalAudioInfo)[], operations: Operation[], httpclient: HttpClient, accessCode?: string) => {
    if (!this.lastRound || this.lastRound?.lastResult) {
      this.addProcessingRound();
    }
    this.changeState(TaskStatus.PROCESSING);
    await wait(2);
    this.time = {
      start: Date.now(),
    };

    const currentRound = this.lastRound!;
    const transcriptFile = operations[2].enabled ? operations[2].lastRound?.lastResult : operations[1].lastRound?.lastResult;
    const audioinfo = this.task?.files?.find((a) => a.isMediaFile()) as TPortalAudioInfo;

    if (transcriptFile?.file && audioinfo) {
      let transcript = '';
      const content = await readFileContents<string>(transcriptFile.file, 'text', 'utf-8');

      const audiofile = new OAudiofile();
      audiofile.duration = audioinfo.duration.samples;
      audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
      audiofile.sampleRate = audioinfo.sampleRate;
      audiofile.size = audioinfo.size;

      if (transcriptFile.extension === '.txt') {
        transcript = content;
      } else {
        const converter = new PartiturConverter();
        const imported = converter.import(
          {
            name: transcriptFile.fullname,
            type: transcriptFile.type,
            content,
            encoding: 'utf-8',
          },
          audiofile,
        );
        transcript = new TextConverter().export(imported.annotjson!, audiofile, 0).file!.content;
      }

      let projectName: string | undefined = undefined;
      try {
        projectName = await this.createSummarizationProject(httpclient);

        await this.uploadFile(
          new File([transcript], `${projectName}.txt`, {
            type: 'text/plain',
          }),
          httpclient,
          projectName,
        );

        await wait(3);
        const res = await this.processSummarizationProject(httpclient, projectName);
      } catch (err: any) {
        // couldn't upload file or process summarization project
        this.throwError(err);

        if (projectName) {
          await this.deleteSummarizationProject(httpclient, projectName);
        }
        return;
      }

      this.subscrManager.add(
        interval(5000).subscribe({
          next: async () => {
            const result = await this.getProjectStatus(httpclient, projectName);

            if (result.status === 'success' && result.body.status === 'finished') {
              if (!result.body.errors) {
                this.time!.duration = Date.now() - this.time!.start;

                const summary = result.body.outputs.find((o: any) => o.filename.includes('summary.txt'));

                if (summary) {
                  const summaryText = await downloadFile(summary.url, 'text');
                  const file = new File([summaryText], `${projectName}.txt`, {
                    type: 'text/plain',
                  });
                  currentRound.results.push(new TPortalFileInfo(file.name, file.type, file.size, file));
                  this.changeState(TaskStatus.FINISHED);
                }
              } else {
                this.throwError(new Error(result.body.errorMessage));
                const errorLogFileURL: string = result.body.outputs.find((o: any) => o.filename === 'error.log')?.url;

                if (errorLogFileURL) {
                  const errorLog = await downloadFile(errorLogFileURL, 'text');
                  console.error('SUMMARIZATION ERROR:\n\n' + errorLog);
                }
              }

              this.subscrManager.removeByTag('status check');
              await this.deleteSummarizationProject(httpclient, projectName);
            }
          },
        }),
        'status check',
      );
    } else {
      this.throwError(new Error('Missing transcript file or audio file.'));
    }
  };

  public clone(task?: Task, id?: number): SummarizationOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    const result = new SummarizationOperation(
      this.name,
      this._commands,
      this.title,
      this.shortTitle,
      selectedTask,
      id,
      this.serviceProvider,
      this.language,
    );
    result.maxNumberOfWords = this.maxNumberOfWords;

    return result;
  }

  public fromAny(operationObj: ISummarizationOperation, commands: string[], task: Task): Operation {
    const result = new SummarizationOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider),
      operationObj.language,
    );
    result.maxNumberOfWords = operationObj.maxNumberOfWords;

    for (const round of operationObj.rounds) {
      result.rounds.push(OperationProcessingRound.fromAny(round));
    }
    result.enabled = operationObj.enabled;

    return result;
  }

  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    id?: number,
    serviceProvider?: ServiceProvider,
    language?: string,
  ) {
    super(name, commands, title, shortTitle, task, id, serviceProvider);
    this._language = language;
    this._description = 'Summarizes a given full text.';
  }

  async createSummarizationProject(httpClient: HttpClient) {
    return new Promise<string>((resolve, reject) => {
      if (this.serviceProvider) {
        const projectName = `tportal_session_${UUID.v7().replace(/-/g, '')}`;

        this.subscrManager.add(
          httpClient
            .post(
              joinURL(this.serviceProvider.host, '/project/create'),
              {
                projectName,
              },
              { responseType: 'json' },
            )
            .subscribe({
              next: () => {
                resolve(projectName);
              },
              error: reject,
            }),
        );
      } else {
        reject(new Error('Missing service provider'));
      }
    });
  }

  async processSummarizationProject(httpclient: HttpClient, projectName: string) {
    return new Promise<void>((resolve, reject) => {
      console.log(`Process project with options ${this.language} and ${this.maxNumberOfWords}`);
      if (this.serviceProvider) {
        this.subscrManager.add(
          httpclient
            .post(
              joinURL(this.serviceProvider.host, '/project/process'),
              {
                projectName,
                language: this.mapLanguage(this.language),
                words: !Number.isNaN(Number(this.maxNumberOfWords)) ? Number(this.maxNumberOfWords) : undefined,
              },
              { responseType: 'json' },
            )
            .subscribe({
              next: () => resolve(),
              error: reject,
            }),
        );
      } else {
        reject(new Error('Missing service provider'));
      }
    });
  }

  getProjectStatus(httpclient: HttpClient, projectName: string) {
    return new Promise<any>((resolve, reject) => {
      if (this.serviceProvider) {
        this.subscrManager.add(
          httpclient
            .get(
              joinURL(
                this.serviceProvider.host,
                `/project${stringifyQueryParams({
                  projectName,
                })}`,
              ),
              { responseType: 'json' },
            )
            .subscribe({
              next: resolve,
              error: reject,
            }),
        );
      }
    });
  }

  deleteSummarizationProject(httpclient: HttpClient, projectName: string) {
    return new Promise<void>((resolve, reject) => {
      if (this.serviceProvider) {
        this.subscrManager.add(
          httpclient
            .delete(joinURL(this.serviceProvider.host, '/project'), {
              responseType: 'json',
              body: {
                projectName,
              },
            })
            .subscribe({
              next: () => resolve(),
              error: reject,
            }),
        );
      } else {
        reject(new Error('Missing service provider'));
      }
    });
  }

  uploadFile(file: File, httpClient: HttpClient, projectName: string) {
    return new Promise<void>((resolve, reject) => {
      if (this.serviceProvider) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectName', projectName);
        this.subscrManager.add(
          httpClient.post(joinURL(this.serviceProvider.host, '/project/upload'), formData).subscribe({
            next: () => resolve(),
            error: reject,
          }),
        );
      } else {
        reject(new Error('Missing service provider'));
      }
    });
  }

  private mapLanguage(isoLanguage?: string) {
    if (isoLanguage) {
      const mappings = {
        deu: 'German',
        nld: 'Dutch',
        ita: 'Italian',
        eng: 'English',
      };

      const parsed = /(.{3})-.*/g.exec(isoLanguage);
      if (parsed && parsed.length === 2) {
        if (Object.keys(mappings).includes(parsed[1])) {
          return (mappings as any)[parsed[1]];
        }
      }
    }
    return 'auto';
  }

  override overwriteOptions(options: OperationOptions) {
    this._serviceProvider = options.summarization?.provider;
    this._language = options.asr?.language;
    this.maxNumberOfWords = options.summarization?.numberOfWords;
  }

  override async toAny(): Promise<ISummarizationOperation> {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      rounds: await this.serializeProcessingRounds(),
      serviceProvider: this.serviceProvider?.provider,
      language: this._language,
      maxNumberOfWords: this.maxNumberOfWords,
    };
  }
}
