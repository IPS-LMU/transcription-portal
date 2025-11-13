import { HttpClient } from '@angular/common/http';
import { PartiturConverter, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { joinURL, stringifyQueryParams, SubscriptionManager, wait } from '@octra/utilities';
import { downloadFile, FileInfo, readFileContents } from '@octra/web-media';
import { interval, Observable, Subject, Subscription } from 'rxjs';
import * as UUID from 'uuid';
import { TaskStatus } from '../../../obj/tasks';
import { AppSettings } from '../../../shared/app.settings';
import { getHashString } from '../../preprocessing/preprocessing.functions';
import { StoreAudioFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { addProcessingRound, getLastOperationResultFromLatestRound, getLastOperationRound } from '../operation.functions';
import { OperationFactory } from './operation-factory';

export interface SummarizationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export type SummarizationOperation = StoreTaskOperation<SummarizationOperationOptions, SummarizationOperation>;

export class SummarizationOperationFactory extends OperationFactory<SummarizationOperation, SummarizationOperationOptions> {
  protected readonly _description = 'Summarizes a given full text.';
  protected readonly _name = 'Summarization';
  protected readonly _resultType = 'Text';
  protected readonly _shortTitle = 'SUM';
  protected readonly _title = 'Summarization';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): SummarizationOperation {
    return {
      enabled: true,
      id,
      name: this.name,
      options: {},
      rounds,
      taskID,
    };
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: SummarizationOperation): SummarizationOperation {
    return {
      ...operation,
      serviceProviderName: options.summarization?.provider === undefined ? operation.serviceProviderName : options.summarization?.provider,
      options: {
        language: options.asr?.language === undefined ? operation.options?.language : options.asr?.language,
        maxNumberOfWords:
          options.summarization?.numberOfWords === undefined ? operation.options?.maxNumberOfWords : options.summarization?.numberOfWords,
      },
    };
  }

  override run(
    storeItemTask: StoreItemTask,
    operation: SummarizationOperation,
    httpClient: HttpClient,
    subscrManager: SubscriptionManager<Subscription>
  ): Observable<{ operation: SummarizationOperation }> {
    const subj = new Subject<{ operation: SummarizationOperation }>();
    let clonedOperation = { ...operation };

    if (!getLastOperationResultFromLatestRound(clonedOperation)) {
      clonedOperation = addProcessingRound(clonedOperation);
    }
    const currentRound = getLastOperationRound(clonedOperation)!;
    currentRound.status = TaskStatus.PROCESSING;
    currentRound.time = {
      start: Date.now(),
    };
    subj.next({ operation: clonedOperation });

    const transcriptFile = storeItemTask.operations[2].enabled
      ? getLastOperationResultFromLatestRound(storeItemTask.operations[2])
      : getLastOperationResultFromLatestRound(storeItemTask.operations[1]);
    const audioinfo = storeItemTask.files?.find((a) => a.type.includes('audio')) as StoreAudioFile;

    (async (): Promise<{
      projectName: string;
      serviceProvider: ServiceProvider;
    }> => {
      if (transcriptFile?.blob && audioinfo) {
        let transcript = '';
        const content = await readFileContents<string>(transcriptFile.blob!, 'text', 'utf-8');

        const audiofile = new OAudiofile();
        audiofile.duration = audioinfo.duration;
        audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.name;
        audiofile.sampleRate = audioinfo.sampleRate;
        audiofile.size = audioinfo.size;
        const { extension } = FileInfo.extractFileName(audiofile.name);

        if (extension === '.txt') {
          transcript = content;
        } else {
          const converter = new PartiturConverter();
          const imported = converter.import(
            {
              name: transcriptFile.name,
              type: transcriptFile.type,
              content,
              encoding: 'utf-8',
            },
            audiofile,
          );
          transcript = new TextConverter().export(imported.annotjson!, audiofile, 0).file!.content;
        }

        const serviceProvider = AppSettings.getServiceInformation(clonedOperation.serviceProviderName);
        let projectName: string | undefined = undefined;
        try {
          projectName = await this.createSummarizationProject(httpClient, serviceProvider!, subscrManager);

          await this.uploadFile(
            new File([transcript], `${projectName}.txt`, {
              type: 'text/plain',
            }),
            httpClient,
            projectName,
            serviceProvider!,
            subscrManager
          );

          await wait(3);
          await this.processSummarizationProject(httpClient, projectName, clonedOperation, serviceProvider!, subscrManager);
          return { projectName, serviceProvider: serviceProvider! };
        } catch (err: any) {
          // couldn't upload file or process summarization project

          if (projectName) {
            await this.deleteSummarizationProject(httpClient, projectName, serviceProvider!, subscrManager);
          }
          throw new Error(err);
        }
      } else {
        throw new Error('Missing transcript file or audio file.');
      }
    })()
      .then(({ serviceProvider, projectName }) => {
        subscrManager.add(
          interval(5000).subscribe({
            next: async () => {
              const result = await this.getProjectStatus(httpClient, projectName, serviceProvider!, subscrManager);

              if (result.status === 'success' && result.body.status === 'finished') {
                subscrManager.removeByTag(`status check (${clonedOperation.id}`);

                if (!result.body.errors) {
                  currentRound.time!.duration = Date.now() - currentRound.time!.start;

                  const summary = result.body.outputs.find((o: any) => o.filename.includes('summary.txt'));

                  if (summary) {
                    const summaryText = await downloadFile(summary.url, 'text');
                    const file = new File([summaryText], `${projectName}.txt`, {
                      type: 'text/plain',
                    });
                    currentRound.results.push({
                      name: file.name,
                      type: file.type,
                      size: file.size,
                      blob: undefined,
                      hash: await getHashString(file),
                      attributes: {
                        originalFileName: file.name,
                      },
                    });
                    currentRound.status = TaskStatus.FINISHED;
                  }
                } else {
                  const errorLogFileURL: string = result.body.outputs.find((o: any) => o.filename === 'error.log')?.url;

                  if (errorLogFileURL) {
                    const errorLog = await downloadFile(errorLogFileURL, 'text');
                    console.error('SUMMARIZATION ERROR:\n\n' + errorLog);
                  }
                }

                subscrManager.removeByTag(`status check (${clonedOperation.id}`);
                await this.deleteSummarizationProject(httpClient, projectName, serviceProvider!, subscrManager);
                throw new Error(result.body.errorMessage);
              }
            },
          }),
          `status check (${clonedOperation.id})`,
        );
      })
      .catch((err) => {
        subj.error(err);
      });

    return subj;
  }

  deleteSummarizationProject(httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider,
                             subscrManager: SubscriptionManager<Subscription>) {
    return new Promise<void>((resolve, reject) => {
      if (serviceProvider) {
        subscrManager.add(
          httpclient
            .delete(joinURL(serviceProvider.host, '/project'), {
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

  async processSummarizationProject(
    httpclient: HttpClient,
    projectName: string,
    clonedOperation: StoreTaskOperation,
    serviceProvider: ServiceProvider,
    subscrManager: SubscriptionManager<Subscription>
  ) {
    return new Promise<void>((resolve, reject) => {
      console.log(`Process project with options ${clonedOperation.options.language} and ${clonedOperation.options.maxNumberOfWords}`);
      if (serviceProvider) {
        subscrManager.add(
          httpclient
            .post(
              joinURL(serviceProvider.host, '/project/process'),
              {
                projectName,
                language: this.mapLanguage(clonedOperation.options.language),
                words: !Number.isNaN(Number(clonedOperation.options.maxNumberOfWords)) ? Number(clonedOperation.options.maxNumberOfWords) : undefined,
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

  async createSummarizationProject(httpClient: HttpClient, serviceProvider: ServiceProvider,
                                   subscrManager: SubscriptionManager<Subscription>) {
    return new Promise<string>((resolve, reject) => {
      if (serviceProvider) {
        const projectName = `tportal_session_${UUID.v7().replace(/-/g, '')}`;

        subscrManager.add(
          httpClient
            .post(
              joinURL(serviceProvider.host, '/project/create'),
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

  getProjectStatus(httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider,
                   subscrManager: SubscriptionManager<Subscription>) {
    return new Promise<any>((resolve, reject) => {
      if (serviceProvider) {
        subscrManager.add(
          httpclient
            .get(
              joinURL(
                serviceProvider.host,
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

  uploadFile(file: File, httpClient: HttpClient, projectName: string, serviceProvider: ServiceProvider,
             subscrManager: SubscriptionManager<Subscription>) {
    return new Promise<void>((resolve, reject) => {
      if (serviceProvider) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectName', projectName);
        subscrManager.add(
          httpClient.post(joinURL(serviceProvider.host, '/project/upload'), formData).subscribe({
            next: () => resolve(),
            error: reject,
          }),
        );
      } else {
        reject(new Error('Missing service provider'));
      }
    });
  }
}
