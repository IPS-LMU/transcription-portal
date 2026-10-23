import { HttpClient } from '@angular/common/http';
import { PartiturConverter, SRTConverter, SRTConverterExportOptions } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { joinURL, stringifyQueryParams, wait } from '@octra/utilities';
import { downloadFile, FileInfo } from '@octra/web-media';
import { interval, Observable, Subject, Subscription } from 'rxjs';
import * as UUID from 'uuid';
import { IDBOperation } from '../../../indexedDB';
import { AppSettings } from '../../../shared/app.settings';
import { getHashString } from '../../preprocessing/preprocessing.functions';
import { StoreAudioFile, StoreItemTask, StoreItemTaskOptions, TaskStatus } from '../../store-item';
import { getLatestResultFromPreviousEnabledOperation } from '../../store-item/store-item.functions';
import { OperationSubscriptionManager, StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { addProcessingRound, convertStoreOperationToIDBOperation, getLastOperationRound } from '../operation.functions';
import { ASROperation } from './asr-operation-factory';
import { OperationFactory } from './operation-factory';

export interface SummarizationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export interface SummarizationContext {
  projectName?: string;
}

export type SummarizationOperation = StoreTaskOperation<SummarizationOperationOptions, SummarizationContext>;

export class SummarizationOperationFactory extends OperationFactory<SummarizationOperation, SummarizationOperationOptions, SummarizationContext> {
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
    let language = operation.options?.language;

    if (options.translation?.language) {
      language = options.translation.language;
    } else if (options.asr?.language) {
      language = options.asr.language;
    }

    return {
      ...operation,
      serviceProviderName: options.summarization?.provider === undefined ? operation.serviceProviderName : options.summarization?.provider,
      options: {
        language,
        maxNumberOfWords:
          options.summarization?.numberOfWords === undefined ? operation.options?.maxNumberOfWords : options.summarization?.numberOfWords,
      },
    };
  }

  override run(
    storeItemTask: StoreItemTask,
    operation: SummarizationOperation,
    httpClient: HttpClient,
    subscriptionManager: OperationSubscriptionManager,
    item$: Observable<StoreItemTask | undefined>,
  ): Observable<{ operation: SummarizationOperation }> {
    const subj = new Subject<{ operation: SummarizationOperation }>();

    subscriptionManager.addSubscription(
      item$.subscribe({
        next: async (item: StoreItemTask | undefined) => {
          if (item?.disabled || item?.stopRequested) {
            await this.runGarbageCollection(item, operation, httpClient, subscriptionManager);
            subscriptionManager.destroy();
          }
        },
      }),
    );

    wait(0).then(() => {
      let clonedOperation = { ...operation };

      if (!getLastOperationRound(clonedOperation)) {
        clonedOperation = addProcessingRound(clonedOperation);
      }
      let currentRound = getLastOperationRound(clonedOperation)!;
      currentRound = {
        ...currentRound,
        status: TaskStatus.PROCESSING,
        time: {
          start: Date.now(),
        },
      };
      this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);

      let transcriptFile = getLatestResultFromPreviousEnabledOperation(storeItemTask, operation);
      const audioinfo = storeItemTask.files?.find((a) => a.type.includes('audio')) as StoreAudioFile;

      if (!transcriptFile) {
        const transcriptFromInputs = storeItemTask?.files.find((a) => !a.type.includes('audio'));
        if (transcriptFromInputs) {
          transcriptFile = transcriptFromInputs;
        }
      }

      (async (): Promise<{
        projectName: string;
        serviceProvider: ServiceProvider;
      }> => {
        if (transcriptFile?.content && audioinfo) {
          let transcript = '';
          const content = transcriptFile?.content;

          const audiofile = new OAudiofile();
          audiofile.duration = audioinfo.duration;
          audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.name;
          audiofile.sampleRate = audioinfo.sampleRate;
          audiofile.size = audioinfo.size;
          const { extension } = FileInfo.extractFileName(transcriptFile.name);

          if (extension === '.srt') {
            transcript = content;
          } else if (extension === '.txt') {
            transcript = content;
          } else {
            // partitur
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
            const asrOperation = storeItemTask.operations[1] as ASROperation;

            if (asrOperation.options.diarization?.enabled) {
              const needsOptions = new SRTConverter().needsOptionsForExport(imported.annotjson!, audiofile);
              const srtOptions = new SRTConverter().getDefaultOptions<SRTConverterExportOptions>(needsOptions);
              transcript = new SRTConverter().export(imported.annotjson!, audiofile, srtOptions).file!.content;
            } else {
              transcript = new SRTConverter().export(imported.annotjson!, audiofile).file!.content;
            }
          }

          const serviceProvider = AppSettings.getServiceInformation(clonedOperation.serviceProviderName);
          let projectName: string | undefined = undefined;
          try {
            projectName = await this.createSummarizationProject(httpClient, serviceProvider!, subscriptionManager);

            // notify about project name
            clonedOperation = {
              ...clonedOperation,
              context: {
                projectName,
              },
            };
            this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);

            await this.uploadFile(
              new File([transcript], `${projectName}.srt`, {
                type: 'text/plain',
              }),
              httpClient,
              projectName,
              serviceProvider!,
              subscriptionManager,
            );

            await wait(3);
            await this.processSummarizationProject(httpClient, projectName, clonedOperation, serviceProvider!, subscriptionManager);
            return { projectName, serviceProvider: serviceProvider! };
          } catch (err: any) {
            // couldn't upload file or process summarization project

            if (projectName) {
              await this.deleteSummarizationProject(httpClient, projectName, serviceProvider!, subscriptionManager);
            }
            throw new Error(err);
          }
        } else {
          throw new Error('Missing transcript file or audio file.');
        }
      })()
        .then(({ serviceProvider, projectName }) => {
          subscriptionManager.addSubscription(
            interval(5000).subscribe({
              next: async () => {
                const result: any = undefined;

                try {
                  await this.getProjectStatus(httpClient, projectName, serviceProvider!, subscriptionManager);
                } catch (error) {
                  console.error(error);
                }

                if (!result) {
                  return;
                }

                if (result.status === 'success' && result.body.status === 'finished') {
                  subscriptionManager.removeByTag(`status check (${clonedOperation.id})`);

                  if (!result.body.errors) {
                    currentRound = {
                      ...currentRound,
                      time: {
                        start: currentRound.time!.start!,
                        duration: Date.now() - currentRound.time!.start,
                      },
                    };

                    const summary = result.body.outputs.find((o: any) => o.filename.includes('summary.txt'));

                    if (summary) {
                      const summaryText = await downloadFile<string>(summary.url, 'text');
                      const { name } = FileInfo.extractFileName(audioinfo.name);
                      const file = new File([summaryText], `${name}.txt`, {
                        type: 'text/plain',
                      });
                      currentRound = {
                        ...currentRound,
                        results: [
                          {
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            blob: undefined,
                            hash: await getHashString(file),
                            content: summaryText,
                            attributes: {
                              originalFileName: file.name,
                            },
                          },
                        ],
                        status: TaskStatus.FINISHED,
                      };
                      this.sendOperationWithUpdatedRound(subj, operation, currentRound);
                      subj.complete();
                    }
                  } else {
                    const errorLogFileURL: string = result.body.outputs.find((o: any) => o.filename === 'error.log')?.url;

                    if (errorLogFileURL) {
                      const errorLog = await downloadFile<string>(errorLogFileURL, 'text');
                      console.error(`ERROR FROM LST SUMMARIZATION SERVICE: ${errorLog}`);
                    }
                  }

                  subscriptionManager.removeByTag(`status check (${clonedOperation.id})`);
                  await this.deleteSummarizationProject(httpClient, projectName, serviceProvider!, subscriptionManager);
                  subj.error(new Error(result.body.errorMessage));
                }
              },
            }),
            `status check (${clonedOperation.id})`,
          );
        })
        .catch((err) => {
          subj.error(err);
        });
    });

    return subj;
  }

  deleteSummarizationProject(
    httpclient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
    subscriptionManager: {
      addSubscription: (subscription: Subscription) => void;
      destroy: () => void;
    },
  ) {
    return new Promise<void>((resolve, reject) => {
      if (serviceProvider) {
        subscriptionManager.addSubscription(
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
    subscriptionManager: {
      addSubscription: (subscription: Subscription) => void;
      destroy: () => void;
    },
  ) {
    return new Promise<void>((resolve, reject) => {
      if (serviceProvider) {
        subscriptionManager.addSubscription(
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

  async createSummarizationProject(
    httpClient: HttpClient,
    serviceProvider: ServiceProvider,
    subscriptionManager: {
      addSubscription: (subscription: Subscription) => void;
      destroy: () => void;
    },
  ) {
    return new Promise<string>((resolve, reject) => {
      if (serviceProvider) {
        const projectName = `tportal_session_${UUID.v7().replace(/-/g, '')}`;

        subscriptionManager.addSubscription(
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

  getProjectStatus(httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider, subscriptionManager: OperationSubscriptionManager) {
    return new Promise<any>((resolve, reject) => {
      if (serviceProvider) {
        subscriptionManager.addSubscription(
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

  uploadFile(
    file: File,
    httpClient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
    subscriptionManager: {
      addSubscription: (subscription: Subscription) => void;
      destroy: () => void;
    },
  ) {
    return new Promise<void>((resolve, reject) => {
      if (serviceProvider) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('projectName', projectName);
        subscriptionManager.addSubscription(
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

  override async convertOperationToIDBOperation(operation: SummarizationOperation): Promise<IDBOperation> {
    const result = await convertStoreOperationToIDBOperation(operation);
    result.language = operation.options.language;
    result.maxNumbersOfWords = operation.options.maxNumberOfWords;

    return result;
  }

  override async runGarbageCollection(
    storeItemTask: StoreItemTask,
    operation: SummarizationOperation,
    httpClient: HttpClient,
    subscriptionManager: OperationSubscriptionManager,
  ) {
    if (operation.context?.projectName) {
      try {
        subscriptionManager.removeByTag(`status check (${operation.id})`);
        const serviceProvider = AppSettings.getServiceInformation(operation.serviceProviderName);
        if (serviceProvider) {
          await this.deleteSummarizationProject(httpClient, operation.context.projectName, serviceProvider, subscriptionManager);
        }
      } catch (error) {
        // ignore
      }
    }
    return;
  }
}
