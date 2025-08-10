import { HttpClient } from '@angular/common/http';
import { PartiturConverter, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { joinURL, last, stringifyQueryParams, wait } from '@octra/utilities';
import {
  AudioInfo,
  downloadFile,
  FileInfo,
  readFileContents,
} from '@octra/web-media';
import { interval } from 'rxjs';
import * as UUID from 'uuid';
import { AppSettings } from '../../shared/app.settings';
import { convertISO639Language } from '../functions';
import { Task, TaskStatus } from '../tasks';
import { IOperation, Operation } from './operation';

export class SummarizationOperation extends Operation {
  public resultType = 'Text';

  public start = (
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode?: string,
  ) => {
    setTimeout(async () => {
      this.updateProtocol('');
      this.changeState(TaskStatus.PROCESSING);
      this._time.start = Date.now();

      console.log('RUN SUMMARIZATION WITH ASR RESULTS');
      console.log(operations[2].results);
      console.log('UPLOAD RESULTS');
      console.log(operations[0].results);

      const transcriptFile = operations[2].enabled
        ? last(operations[2].results)
        : last(operations[1].results);
      const audioinfo = operations[0].task!.files[0] as AudioInfo;

      if (transcriptFile?.file && audioinfo) {
        let transcript = '';
        const content = await readFileContents<string>(
          transcriptFile.file,
          'text',
          'utf-8',
        );

        const audiofile = new OAudiofile();
        audiofile.duration = audioinfo.duration.samples;
        audiofile.name =
          audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
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
          transcript = new TextConverter().export(
            imported.annotjson!,
            audiofile,
            0,
          ).file!.content;
        }

        console.log('TRANSCRIPT');
        console.log(transcript);

        const projectName = await this.createSummarizationProject(httpclient);
        console.log(`Created project ${projectName}`);
        try {
          await this.uploadFile(
            new File([transcript], `${projectName}.txt`, {
              type: 'text/plain',
            }),
            httpclient,
            projectName,
          );
          console.log('uploaded file to project successfully');

          console.log('Start processing...');
          await wait(3);
          const res = await this.processSummarizationProject(
            httpclient,
            projectName,
          );
          console.log(res);
        } catch (err: any) {
          // couldn't upload file or process summarization project
          this.changeState(TaskStatus.ERROR);
          this.updateProtocol(
            err?.error?.message ?? err?.message ?? err?.toString(),
          );
          await this.deleteSummarizationProject(httpclient, projectName);
          return;
        }

        this.subscrManager.add(
          interval(5000).subscribe({
            next: async () => {
              const result = await this.getProjectStatus(
                httpclient,
                projectName,
              );
              console.log('Retrieve project status...');
              console.log(result);

              if (
                result.status === 'success' &&
                result.body.status === 'finished'
              ) {
                if (!result.body.errors) {
                  this.time.duration = Date.now() - this.time.start;

                  const summary = result.body.outputs.find((o: any) =>
                    o.filename.includes('summary.txt'),
                  );

                  if (summary) {
                    const summaryText = await downloadFile(summary.url, 'text');
                    const file = new File([summaryText], `${projectName}.txt`, {
                      type: 'text/plain',
                    });
                    this.results.push(
                      new FileInfo(file.name, file.type, file.size, file),
                    );
                    console.log('ADD TO RESULTS:');
                    console.log(this.results);
                    this.changeState(TaskStatus.FINISHED);
                  }
                } else {
                  this.changeState(TaskStatus.ERROR);
                  this.updateProtocol(result.body.errorMessage);

                  const errorLogFileURL: string = result.body.outputs.find(
                    (o: any) => o.filename === 'error.log',
                  )?.url;
                  if (errorLogFileURL) {
                    const errorLog = await downloadFile(
                      errorLogFileURL,
                      'text',
                    );
                    console.error('SUMMARIZATION ERROR:\n\n' + errorLog);
                  }
                }

                this.subscrManager.removeByTag('status check');
                console.log('Remove project');
                await this.deleteSummarizationProject(httpclient, projectName);
              }
            },
          }),
          'status check',
        );
        console.log('processing finished');
      } else {
        this.changeState(TaskStatus.ERROR);
        this.updateProtocol('Missing transcript file or audio file.');
      }
    }, 2000);
  };

  public clone(task?: Task): SummarizationOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new SummarizationOperation(
      this.name,
      this._commands,
      this.title,
      this.shortTitle,
      selectedTask,
      this.state,
      undefined,
      this.serviceProvider,
      this.language,
    );
  }

  public fromAny(
    operationObj: IOperation,
    commands: string[],
    task: Task,
    taskObj?: any,
  ): Operation {
    const result = new SummarizationOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider) ??
        AppSettings.getServiceInformation(taskObj.summarizationServiceProvider),
      operationObj.language ?? taskObj.targetLanguage,
    );

    for (const resultObj of operationObj.results) {
      const resultClass = FileInfo.fromAny(resultObj);
      resultClass.attributes = resultObj.attributes;
      result.results.push(resultClass);
    }

    result._time = operationObj.time;
    result.updateProtocol(operationObj.protocol.replace('¶', ''));
    result.enabled = operationObj.enabled;

    return result;
  }

  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    state?: TaskStatus,
    id?: number,
    serviceProvider?: ServiceProvider,
    language?: string,
  ) {
    super(
      name,
      commands,
      title,
      shortTitle,
      task,
      state,
      id,
      serviceProvider,
      language,
    );
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
        reject('Missing service provider');
      }
    });
  }

  async processSummarizationProject(
    httpclient: HttpClient,
    projectName: string,
  ) {
    return new Promise<void>((resolve, reject) => {
      if (this.serviceProvider && this.language) {
        console.log(
          `convert ${this.language} to ${convertISO639Language(this.language)}`,
        );
        this.subscrManager.add(
          httpclient
            .post(
              joinURL(this.serviceProvider.host, '/project/process'),
              {
                projectName,
                language: 'en',
              },
              { responseType: 'json' },
            )
            .subscribe({
              next: () => resolve(),
              error: reject,
            }),
        );
      } else {
        reject('Missing service provider');
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
        reject('Missing service provider');
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
          httpClient
            .post(
              joinURL(this.serviceProvider.host, '/project/upload'),
              formData,
            )
            .subscribe({
              next: () => resolve(),
              error: reject,
            }),
        );
      } else {
        reject('Missing service provider');
      }
    });
  }
}
