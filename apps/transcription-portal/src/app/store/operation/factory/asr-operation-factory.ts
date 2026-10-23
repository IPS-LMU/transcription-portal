import { HttpClient } from '@angular/common/http';
import { PartiturConverter, SRTConverter } from '@octra/annotation';
import { ServiceProvider } from '@octra/ngx-components';
import { extractFileNameFromURL, joinURL, stringifyQueryParams, wait } from '@octra/utilities';
import { downloadFile, FileInfo } from '@octra/web-media';
import { from, interval, Observable, retry, Subject } from 'rxjs';
import * as UUID from 'uuid';
import X2JS from 'x2js';
import { SUPPORTED_LANGUAGES } from '../../../app.info';
import { IDBOperation } from '../../../indexedDB';
import { AppSettings } from '../../../shared/app.settings';
import { getEscapedFileName, getHashString } from '../../preprocessing/preprocessing.functions';
import { StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions, TaskStatus } from '../../store-item';
import { convertFileInfoToStoreFile } from '../../store-item/store-item.functions';
import { OperationSubscriptionManager, StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { addProcessingRound, convertStoreOperationToIDBOperation, getLastOperationRound } from '../operation.functions';
import { OperationFactory } from './operation-factory';
import { UploadOperationFactory } from './upload-operation-factory';

export interface ASROperationOptions {
  language?: string;
  diarization?: {
    enabled?: boolean;
    speakers?: number;
  };
  accessCode?: string;
}

export interface ASROperationContext {
  lst?: {
    projectName?: string;
  };
}

export type ASROperation = StoreTaskOperation<ASROperationOptions, ASROperationContext>;

export class ASROperationFactory extends OperationFactory<ASROperation, ASROperationOptions, ASROperationContext> {
  protected readonly _description =
    'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
    'The result of this process is a text file with a literal transcription of the audio file. \n' +
    'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  protected readonly _name = 'ASR';
  protected readonly _resultType = 'BAS Partitur Format';
  protected readonly _shortTitle = 'ASR';
  protected readonly _title = 'Speech Recognition';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): ASROperation {
    return {
      enabled: true,
      id,
      name: this.name,
      options: {},
      rounds,
      taskID,
    };
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: ASROperation) {
    return {
      ...operation,
      serviceProviderName: options.asr?.provider === undefined ? operation.serviceProviderName : options.asr?.provider,
      options: {
        language: options.asr?.language === undefined ? operation.options?.language : options.asr?.language,
        diarization: options.asr?.diarization === undefined ? operation.options?.diarization : options.asr?.diarization,
        accessCode: options?.asr?.accessCode,
      },
    };
  }

  override run = (
    task: StoreItemTask,
    operation: ASROperation,
    httpClient: HttpClient,
    subscrManager: OperationSubscriptionManager,
    item$: Observable<StoreItemTask | undefined>,
  ): Observable<{ operation: StoreTaskOperation }> => {
    const subj = new Subject<{
      operation: ASROperation;
    }>();

    subscrManager.addSubscription(
      item$.subscribe({
        next: async (item: StoreItemTask | undefined) => {
          if (item?.disabled || item?.stopRequested) {
            await this.runGarbageCollection(item, operation, httpClient, subscrManager);
            subscrManager.destroy();
          }
        },
      }),
    );

    subscrManager.addSubscription(
      from(wait(1)).subscribe({
        next: () => {
          const audioFile: StoreAudioFile | undefined = (task.files?.find((a) => a.type.includes('audio')) ??
            task.files.find((a) => a.type.includes('audio'))) as StoreAudioFile | undefined;
          let clonedOperation = { ...operation };
          if (!getLastOperationRound(clonedOperation)) {
            clonedOperation = addProcessingRound(clonedOperation);
          }
          let currentRound = getLastOperationRound(clonedOperation)!;
          currentRound = {
            ...currentRound,
            protocol: '',
            status: TaskStatus.PROCESSING,
            time: {
              start: Date.now(),
            },
          };

          if (!audioFile) {
            subj.error(new Error('Missing audio file'));
            return;
          }

          this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);

          if (clonedOperation.serviceProviderName) {
            let callASRSubj:
              | Observable<{
                  result: StoreFile;
                  warnings?: string;
                }>
              | undefined;

            if (clonedOperation.serviceProviderName === 'LSTWhisperX') {
              callASRSubj = from(this.callASRFromRadboud(httpClient, audioFile, clonedOperation, subscrManager, currentRound, subj));
            } else {
              callASRSubj = from(this.callASRFromBASWebservices(httpClient, audioFile, clonedOperation, subscrManager));
            }

            subscrManager.addSubscription(
              callASRSubj.subscribe({
                next: async ({ result, warnings }) => {
                  let asrResult = result;

                  if (asrResult && clonedOperation.serviceProviderName) {
                    const g2pChunkerNeeded =
                      (task.operations[2]?.name === 'OCTRA' &&
                        task.operations[2]?.enabled === false &&
                        task.operations[3]?.name === 'MAUS' &&
                        task.operations[3]?.enabled === false) ||
                      task.operations[3]?.name === 'Summarization' ||
                      (!clonedOperation.options.diarization?.enabled && clonedOperation.serviceProviderName === 'Google');
                    // use G2P_CHUNKER only if Octra and Word alignment is disabled or summarization mode or if service provider is Google and diarization disabled

                    currentRound = {
                      ...currentRound,
                      time: {
                        ...currentRound.time!,
                        duration: Date.now() - currentRound.time!.start,
                      },
                      protocol: warnings ? currentRound.protocol + 'WARNING: ' + warnings + '<br/>' : currentRound.protocol,
                    };

                    try {
                      if (g2pChunkerNeeded) {
                        const g2pResult = await this.callG2PChunker(
                          AppSettings.getServiceInformation('BAS')!,
                          httpClient,
                          asrResult,
                          audioFile,
                          clonedOperation,
                          subscrManager,
                        );
                        asrResult = g2pResult.result;
                        warnings = g2pResult.warnings;
                      }

                      currentRound = {
                        ...currentRound,
                        time: {
                          ...currentRound.time!,
                          duration: Date.now() - currentRound.time!.start,
                        },
                        protocol: warnings ? currentRound.protocol + 'WARNING: ' + warnings + '<br/>' : currentRound.protocol,
                      };

                      if (asrResult.content) {
                        const { name } = FileInfo.extractFileName(audioFile.attributes.originalFileName ?? audioFile.name);
                        const { extension } = FileInfo.extractFileName(asrResult.attributes.originalFileName ?? asrResult.name);
                        const content = asrResult.content;
                        const hash = await getHashString(
                          new File([asrResult.content], asrResult.attributes.originalFileName, { type: asrResult.type }),
                        );
                        const escapedName = getEscapedFileName(hash);

                        asrResult.attributes = {
                          originalFileName: `${name}${extension}`,
                        };

                        currentRound = {
                          ...currentRound,
                          status: TaskStatus.FINISHED,
                          results: [
                            ...currentRound.results,
                            {
                              ...asrResult,
                              name: `${escapedName}${extension}`,
                              content,
                              hash,
                              blob: undefined,
                            },
                          ],
                        };
                        this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);
                        subj.complete();
                      } else {
                        subj.error(new Error('Missing result for ASR.'));
                      }
                    } catch (e: any) {
                      subj.error(e);
                    }
                  }
                },
                error: (err) => {
                  subj.error(err);
                },
              }),
            );
          } else {
            currentRound = {
              ...currentRound,
              protocol: '<br/>' + 'serviceProvider is undefined',
              time: {
                ...currentRound.time!,
                duration: Date.now() - currentRound.time!.start,
              },
            };
            this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);
            subj.error('serviceProvider is undefined');
          }
        },
      }),
    );

    return subj;
  };

  private callASRFromBASWebservices(
    httpClient: HttpClient,
    input: StoreAudioFile,
    clonedOperation: ASROperation,
    subscrManager: OperationSubscriptionManager,
  ): Promise<{
    result: StoreFile;
    warnings?: string;
  }> {
    return new Promise<{
      result: StoreFile;
      warnings?: string;
    }>((resolve, reject) => {
      if (clonedOperation.serviceProviderName) {
        const serviceProvider = AppSettings.getServiceInformation(clonedOperation.serviceProviderName);
        let url = this.commands[0]
          .replace('{{host}}', serviceProvider!.host)
          .replace('{{audioURL}}', input?.url ?? '')
          .replace('{{asrType}}', clonedOperation.serviceProviderName)
          .replace('{{language}}', clonedOperation.options.language!);

        if (clonedOperation.options.diarization?.enabled) {
          url += `&diarization=${clonedOperation.options.diarization?.enabled ?? false}`;

          if (clonedOperation.options.diarization.speakers) {
            url += `&numberSpeakDiar=${clonedOperation.options.diarization.speakers}`;
          }

          // set custom speaker labels
          const speakMatch = Array.from({ length: 10 }, (_, i) => (i < 10 ? `SPEAKER_0${i}` : `SPEAKER_${i}`)).join(',');
          url += `&speakMatch=${speakMatch}`;
        }

        if (clonedOperation.options.accessCode && clonedOperation.options.accessCode !== '' && clonedOperation.serviceProviderName === 'Google') {
          url += `&ACCESSCODE=${clonedOperation.options.accessCode}`;
        }

        subscrManager.addSubscription(
          httpClient
            .post(
              url,
              {},
              {
                headers: {
                  'Content-Type': 'multipart/form-data',
                },
                responseType: 'text',
              },
            )
            .subscribe({
              next: (result: string) => {
                // convert result to json
                const x2js = new X2JS();
                let json: any = x2js.xml2js(result);
                json = json.WebServiceResponseLink;

                if (json.success === 'true') {
                  const { extension } = extractFileNameFromURL(json.downloadLink);
                  const file = FileInfo.fromURL(json.downloadLink, 'text/plain', input.name + extension, Date.now());
                  file
                    .updateContentFromURL(httpClient)
                    .then(async (content: string) => {
                      let warnings: string | undefined;
                      // add messages to protocol
                      if (json.warnings !== '') {
                        warnings = '<br/>' + json.warnings.replace('¶', '');
                      } else if (json.output !== '') {
                        warnings = '<br/>' + json.output.replace('¶', '');
                      }

                      const hash = await getHashString(new File([content], file.fullname, { type: file.type }));
                      resolve({
                        result: {
                          ...(await convertFileInfoToStoreFile(file)),
                          blob: undefined,
                          content,
                          hash,
                          name: getEscapedFileName(hash) + file.extension,
                          attributes: {
                            originalFileName: file.fullname,
                          },
                        } as unknown as StoreFile,
                        warnings,
                      });
                    })
                    .catch((error: any) => {
                      reject(error);
                    });
                } else {
                  reject(json.output);
                }
              },
              error: (error: any) => {
                reject(error.message);
              },
            }),
        );
      } else {
        reject(new Error('Missing ASR Provider.'));
      }
    });
  }

  private callASRFromRadboud = async (
    httpClient: HttpClient,
    audioFile: StoreAudioFile,
    clonedOperation: StoreTaskOperation,
    subscrManager: OperationSubscriptionManager,
    currentRound: StoreTaskOperationProcessingRound,
    subj: Subject<{
      operation: ASROperation;
    }>,
  ): Promise<{
    result: StoreFile;
    warnings?: string;
  }> => {
    if (clonedOperation.serviceProviderName) {
      const serviceProvider = AppSettings.getServiceInformation(clonedOperation.serviceProviderName);
      if (audioFile) {
        // 1. Create a new project with unique ID
        const projectName = await this.createLSTASRProject(httpClient, serviceProvider!, subscrManager);
        clonedOperation = {
          ...clonedOperation,
          context: {
            lst: {
              projectName,
            },
          },
        };
        this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);
        await wait(1);
        // 2. Upload files
        await this.uploadFileToLST(audioFile, httpClient, projectName, serviceProvider!, subscrManager);
        await this.processASRLSTProject(httpClient, projectName, clonedOperation, serviceProvider!, subscrManager);

        return new Promise<{
          result: StoreFile;
          warnings?: string;
        }>((resolve, reject) => {
          subscrManager.addSubscription(
            interval(5000).subscribe({
              next: async () => {
                if (clonedOperation.serviceProviderName) {
                  const result = await this.getLSTProjectStatus(httpClient, projectName, serviceProvider!);

                  if (result.status === 'success' && result.body.status === 'finished') {
                    subscrManager.removeByTag(`status check (${clonedOperation.id})`);
                    if (!result.body.errors) {
                      const outputFile = result.body.outputs.find((o: any) => o.template === 'SRT');

                      if (outputFile) {
                        const outputFileText = await downloadFile<string>(outputFile.url, 'text');

                        const srtConverter = new SRTConverter();
                        const originalName = FileInfo.extractFileName(audioFile.attributes.originalFileName).name;
                        const importResult = srtConverter.import(
                          { name: originalName + '.srt', type: 'text/plain', content: outputFileText, encoding: 'utf-8' },
                          audioFile,
                          clonedOperation.options.diarization?.enabled
                            ? {
                                sortSpeakerSegments: true,
                                speakerIdentifierPattern: '\\[(SPEAKER_[0-9]+)\\]: ',
                              }
                            : undefined,
                        );

                        if (importResult.annotjson) {
                          const parConverter = new PartiturConverter();
                          const partiturOutput = parConverter.export(importResult.annotjson, audioFile);

                          if (partiturOutput.file) {
                            const file = new File([partiturOutput.file.content], partiturOutput.file.name, { type: partiturOutput.file.type });
                            await this.deleteLSTASRProject(httpClient, projectName, serviceProvider!, subscrManager);
                            const hash = await getHashString(file);

                            resolve({
                              result: {
                                name: `${hash}.par`,
                                type: partiturOutput.file.type,
                                size: file.size,
                                content: partiturOutput.file.content,
                                attributes: {
                                  originalFileName: file.name,
                                },
                                hash,
                              },
                            });
                          }
                        } else {
                          await this.deleteLSTASRProject(httpClient, projectName, serviceProvider!, subscrManager);
                          reject(new Error("Can't import LST SRT output to AnnotjSON."));
                        }
                      }
                    } else {
                      const errorFile = result.body.outputs.find((o: any) => o.template === 'errorlog');
                      if (errorFile?.url) {
                        try {
                          const content = await downloadFile<string>(errorFile.url, 'text');
                          console.error(`ERROR FROM LST ASR SERVICE: ${content}`);
                        } catch (error) {
                          console.error(`Can't retrieve error log from LST.`);
                        }
                      }

                      if (result.body.errorMessage === 'An error occurred within the system. Please inspect the error log for details') {
                        result.body.errorMessage += '. This error could be temporary. Please retry this task later again.';
                      }
                      reject(result.body.errorMessage);
                    }
                  }
                }
              },
            }),
            `status check (${clonedOperation.id})`,
          );
        });
      } else {
        throw new Error('Missing input file.');
      }
    } else {
      throw new Error('Missing ASR Provider.');
    }
  };

  private callG2PChunker(
    asrService: ServiceProvider,
    httpClient: HttpClient,
    asrResult: StoreFile,
    audioFile: StoreAudioFile,
    clonedOperation: ASROperation,
    subscrManager: OperationSubscriptionManager,
  ): Promise<{
    result: StoreFile;
    warnings?: string;
  }> {
    return new Promise<{
      result: StoreFile;
      warnings?: string;
    }>((resolve, reject) => {
      new Promise<string>((resolve2, reject2) => {
        subscrManager.addSubscription(
          UploadOperationFactory.upload([asrResult], httpClient).subscribe({
            next: (event) => {
              if (event.type === 'loadend') {
                if (event.urls) {
                  resolve2(event.urls[0]);
                } else {
                  reject2(new Error('Missung upload URL'));
                }
              }
            },
            error: (error) => {
              reject2(error);
            },
          }),
        );
      })
        .then((asrURL) => {
          const url = this.commands[1]
            .replace('{{host}}', asrService.host)
            .replace('{{transcriptURL}}', asrURL)
            .replace('{{audioURL}}', audioFile?.url ?? '')
            .replace('{{asrType}}', `${asrService.provider}`)
            .replace('{{language}}', clonedOperation.options.language!);

          subscrManager.addSubscription(
            httpClient
              .post(
                url,
                {},
                {
                  headers: {
                    'Content-Type': 'multipart/form-data',
                  },
                  responseType: 'text',
                },
              )
              .subscribe({
                next: (result: string) => {
                  // convert result to json
                  const x2js = new X2JS();
                  let json: any = x2js.xml2js(result);
                  json = json.WebServiceResponseLink;

                  if (json.success === 'true') {
                    const { extension } = extractFileNameFromURL(json.downloadLink);
                    const { name } = FileInfo.extractFileName(audioFile.attributes.originalFileName);
                    const file = FileInfo.fromURL(json.downloadLink, 'text/plain', name + extension, Date.now());
                    setTimeout(() => {
                      file
                        .updateContentFromURL(httpClient)
                        .then(async (content) => {
                          let warnings: string | undefined = undefined;

                          if (json.warnings !== '') {
                            warnings = '<br/>' + json.warnings.replace('¶', '');
                          } else if (json.output !== '') {
                            warnings = '<br/>' + json.output.replace('¶', '');
                          }
                          const hash = await getHashString(new File([content], file.name, { type: file.type }));

                          resolve({
                            result: {
                              name: `${getEscapedFileName(hash)}${file.extension}`,
                              attributes: { originalFileName: file.fullname },
                              type: file.type,
                              size: file.size,
                              content,
                              hash,
                              url: file.url,
                              online: true,
                            },
                            warnings,
                          });
                        })
                        .catch((error) => {
                          reject(error);
                        });
                    }, 1000);
                  } else {
                    reject(json.output);
                  }
                },
                error: (error) => {
                  reject(error.message);
                },
              }),
          );
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private createLSTASRProject = async (httpClient: HttpClient, asrProvider: ServiceProvider, subscrManager: OperationSubscriptionManager) => {
    return new Promise<string>((resolve, reject) => {
      const projectName = `tportal_session_${UUID.v7().replace(/-/g, '')}`;

      subscrManager.addSubscription(
        httpClient
          .post(
            joinURL(asrProvider.host, '/project/create'),
            {
              projectName,
            },
            { responseType: 'json' },
          )
          .pipe(retry({ count: 3, delay: 2000 }))
          .subscribe({
            next: () => {
              resolve(projectName);
            },
            error: reject,
          }),
      );
    });
  };

  private uploadFileToLST = (
    file: StoreAudioFile,
    httpClient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
    subscrManager: OperationSubscriptionManager,
  ) => {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      const { name } = FileInfo.extractFileName(file.name);
      if (file.blob) {
        // upload with file
        formData.append('file', file.blob, file.name);
      } else if (file.url) {
        // upload with URL
        formData.append('url', file.url);
        formData.append('basename', name);
      } else {
        reject(new Error('Missing file or URL for upload.'));
        return;
      }
      formData.append('projectName', projectName);
      subscrManager.addSubscription(
        httpClient.post(joinURL(serviceProvider.host, '/project/upload'), formData).subscribe({
          next: () => resolve(),
          error: reject,
        }),
      );
    });
  };

  processASRLSTProject = async (
    httpclient: HttpClient,
    projectName: string,
    clonedOperation: ASROperation,
    serviceProvider: ServiceProvider,
    subscrManager: OperationSubscriptionManager,
  ) => {
    return new Promise<void>((resolve, reject) => {
      if (clonedOperation.options.language) {
        subscrManager.addSubscription(
          httpclient
            .post(
              joinURL(serviceProvider.host, '/project/process'),
              {
                projectName,
                language: this.mapLanguageForLST(clonedOperation.options.language),
                gpu: true,
                diarization: clonedOperation.options.diarization?.enabled ?? false,
                minspeakers: clonedOperation.options.diarization?.enabled ? clonedOperation.options.diarization?.speakers : undefined,
                maxspeakers: clonedOperation.options.diarization?.enabled ? clonedOperation.options.diarization?.speakers : undefined,
              },
              { responseType: 'json' },
            )
            .subscribe({
              next: () => resolve(),
              error: reject,
            }),
        );
      } else {
        reject(new Error('Missing language'));
      }
    });
  };

  private mapLanguageForLST(isoLanguage: string) {
    const parsed = /(.{3})-.*/g.exec(isoLanguage);
    if (parsed && parsed.length === 2) {
      if (Object.keys(SUPPORTED_LANGUAGES).includes(parsed[1])) {
        return (SUPPORTED_LANGUAGES as any)[parsed[1]];
      }
    }
  }

  getLSTProjectStatus = async (httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider) => {
    return new Promise<any>((resolve, reject) => {
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
        });
    });
  };

  deleteLSTASRProject = async (
    httpclient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
    subscrManager: OperationSubscriptionManager,
  ) => {
    return new Promise<void>((resolve, reject) => {
      subscrManager.addSubscription(
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
    });
  };

  override async convertOperationToIDBOperation(operation: ASROperation): Promise<IDBOperation> {
    const result = await convertStoreOperationToIDBOperation(operation);
    result.diarization = operation.options.diarization;
    result.language = operation.options.language;

    return result;
  }

  override async runGarbageCollection(
    storeItemTask: StoreItemTask,
    operation: ASROperation,
    httpClient: HttpClient,
    subscriptionManager: OperationSubscriptionManager,
  ) {
    if (operation.context?.lst?.projectName) {
      try {
        subscriptionManager.removeByTag(`status check (${operation.id})`);
        const serviceProvider = AppSettings.getServiceInformation(operation.serviceProviderName);
        if (serviceProvider) {
          await this.deleteLSTASRProject(httpClient, operation.context.lst?.projectName, serviceProvider, subscriptionManager);
        }
      } catch (error) {
        // ignore
      }
    }
    return;
  }
}
