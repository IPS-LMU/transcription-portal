import { HttpClient } from '@angular/common/http';
import { input } from '@angular/core';
import { PartiturConverter, SRTConverter } from '@octra/annotation';
import { ServiceProvider } from '@octra/ngx-components';
import { extractFileNameFromURL, joinURL, stringifyQueryParams, wait } from '@octra/utilities';
import { downloadFile, FileInfo } from '@octra/web-media';
import { from, interval, Observable, Subject, throwError } from 'rxjs';
import * as UUID from 'uuid';
import * as X2JS from 'x2js';
import { TaskStatus } from '../../../obj/tasks';
import { AppSettings } from '../../../shared/app.settings';
import { getHashString } from '../../preprocessing/preprocessing.functions';
import { StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';
import { UploadOperationFactory } from './upload-operation-factory';
import { convertFileInfoToStoreFile } from '../../store-item/store-item.functions';

export interface ASROperationOptions {
  language?: string;
  diarization?: {
    enabled?: boolean;
    speakers?: number;
  };
  accessCode?: string;
}

export class ASROperation extends StoreTaskOperation<ASROperationOptions, ASROperation> {
  override clone(): ASROperation {
    return new ASROperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, ASROperation>>): ASROperation {
    return new ASROperation(partial);
  }
}

export class ASROperationFactory extends OperationFactory<ASROperation, ASROperationOptions> {
  protected readonly _description =
    'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
    'The result of this process is a text file with a literal transcription of the audio file. \n' +
    'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  protected readonly _name = 'ASR';
  protected readonly _resultType = 'BAS Partitur Format';
  protected readonly _shortTitle = 'ASR';
  protected readonly _title = 'Speech Recognition';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): ASROperation {
    return new ASROperation({
      enabled: true,
      id,
      name: this.name,
      options: {},
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: ASROperation) {
    return operation.duplicate({
      ...operation,
      serviceProviderName: options.asr?.provider === undefined ? operation.serviceProviderName : options.asr?.provider,
      options: {
        language: options.asr?.language === undefined ? operation.options?.language : options.asr?.language,
        diarization: options.asr?.diarization === undefined ? operation.options?.diarization : options.asr?.diarization,
      },
    });
  }

  override run(task: StoreItemTask, operation: ASROperation, httpClient: HttpClient): Observable<{ operation: StoreTaskOperation }> {
    const audioFile: StoreAudioFile | undefined = (task.operations[0].lastRound?.results.find((a) => a.type.includes('audio')) ??
      task.files.find((a) => a.type.includes('audio'))) as StoreAudioFile | undefined;
    const clonedOperation = operation.clone();
    const subj = new Subject<{
      operation: ASROperation;
    }>();
    if (!clonedOperation.lastRound) {
      clonedOperation.addProcessingRound();
    }
    const currentRound = clonedOperation.lastRound!;
    currentRound.protocol = '';
    currentRound.status = TaskStatus.PROCESSING;
    currentRound.time = {
      start: Date.now(),
    };

    if (!audioFile) {
      return throwError(() => new Error('Missing audio file'));
    }
    subj.next({ operation: clonedOperation });

    if (clonedOperation.serviceProviderName) {
      let callASRSubj: Observable<StoreFile> | undefined;

      if (clonedOperation.serviceProviderName === 'LSTWhisperX') {
        callASRSubj = from(this.callASRFromRadboud(httpClient, audioFile, clonedOperation));
      } else {
        callASRSubj = from(this.callASRFromBASWebservices(httpClient, audioFile, clonedOperation));
      }

      callASRSubj.subscribe({
        next: async (asrResult) => {
          if (asrResult && clonedOperation.serviceProviderName) {
            const g2pChunkerNeeded =
              (task.operations[2]?.name === 'OCTRA' &&
                task.operations[2]?.enabled === false &&
                task.operations[3]?.name === 'MAUS' &&
                task.operations[3]?.enabled === false) ||
              task.operations[3]?.name === 'SUMMARIZATION' ||
              (!clonedOperation.options.diarization?.enabled && clonedOperation.serviceProviderName === 'Google');
            // use G2P_CHUNKER only if Octra and Word alignment is disabled or summarization mode or if service provider is Google and diarization disabled

            try {
              if (g2pChunkerNeeded) {
                asrResult = await this.callG2PChunker(AppSettings.getServiceInformation('BAS')!, httpClient, asrResult, audioFile, clonedOperation);
              }

              currentRound.time!.duration = Date.now() - currentRound.time!.start;

              if (asrResult.blob) {
                const { extension, name } = FileInfo.extractFileName(audioFile.attributes.originalFileName ?? audioFile.name);

                asrResult.attributes = {
                  originalFileName: `${name}${extension}`,
                };
                currentRound.results.push(asrResult);
                subj.next({ operation: clonedOperation });
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
          subj.next(err);
        },
      });
    } else {
      currentRound.protocol += "'<br/>' + 'serviceProvider is undefined'";
      currentRound.time!.duration = Date.now() - currentRound.time!.start;
      subj.next({ operation: clonedOperation });
      subj.error('serviceProvider is undefined');
    }

    return subj;
  }

  private callASRFromBASWebservices(httpClient: HttpClient, input: StoreAudioFile, clonedOperation: ASROperation): Promise<StoreFile> {
    return new Promise<StoreFile>((resolve, reject) => {
      if (clonedOperation.serviceProviderName) {
        const serviceProvider = AppSettings.getServiceInformation(clonedOperation.serviceProviderName);
        let url =
          this.commands[0]
            .replace('{{host}}', serviceProvider!.host)
            .replace('{{audioURL}}', input?.url ?? '')
            .replace('{{asrType}}', clonedOperation.serviceProviderName)
            .replace('{{language}}', clonedOperation.options.language!) + `&diarization=${clonedOperation.options.diarization?.enabled ?? false}`;

        if (clonedOperation.options.diarization?.enabled && clonedOperation.options.diarization?.speakers) {
          url += `&numberSpeakDiar=${clonedOperation.options.diarization.speakers}`;
        }

        if (clonedOperation.options.accessCode && clonedOperation.options.accessCode !== '') {
          url += `&ACCESSCODE=${clonedOperation.options.accessCode}`;
        }

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
              const currentRound = clonedOperation.lastRound!;
              // convert result to json
              const x2js = new X2JS();
              let json: any = x2js.xml2js(result);
              json = json.WebServiceResponseLink;

              if (json.success === 'true') {
                const { extension } = extractFileNameFromURL(json.downloadLink);
                const file = FileInfo.fromURL(json.downloadLink, 'text/plain', input.name + extension, Date.now());
                file
                  .updateContentFromURL(httpClient)
                  .then((content: string) => {
                    // add messages to protocol
                    if (json.warnings !== '') {
                      currentRound.protocol += '<br/>' + json.warnings.replace('¶', '');
                    } else if (json.output !== '') {
                      currentRound.protocol += '<br/>' + json.output.replace('¶', '');
                    }

                    resolve({ ...convertFileInfoToStoreFile(file), blob: undefined, content });
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
          });
      } else {
        reject(new Error('Missing ASR Provider.'));
      }
    });
  }

  private async callASRFromRadboud(httpClient: HttpClient, audioFile: StoreAudioFile, clonedOperation: StoreTaskOperation): Promise<StoreFile> {
    if (clonedOperation.serviceProviderName) {
      const serviceProvider = AppSettings.getServiceInformation(clonedOperation.serviceProviderName);
      if (audioFile) {
        // 1. Create a new project with unique ID
        const projectName = await this.createLSTASRProject(httpClient, serviceProvider!);
        await wait(1);
        // 2. Upload files
        await this.uploadFileToLST(audioFile, httpClient, projectName, serviceProvider!);
        await this.processASRLSTProject(httpClient, projectName, clonedOperation, serviceProvider!);

        return new Promise<StoreFile>((resolve, reject) => {
          this.subscrManager.add(
            interval(5000).subscribe({
              next: async () => {
                if (clonedOperation.serviceProviderName) {
                  const result = await this.getLSTProjectStatus(httpClient, projectName, serviceProvider!);

                  if (result.status === 'success' && result.body.status === 'finished') {
                    this.subscrManager.removeByTag(`status check (${clonedOperation.id})`);
                    if (!result.body.errors) {
                      clonedOperation.time!.duration = Date.now() - clonedOperation.time!.start;

                      const outputFile = result.body.outputs.find((o: any) => o.template === 'SRT');

                      if (outputFile) {
                        const outputFileText = (await downloadFile(outputFile.url, 'text')) as any as string;

                        const srtConverter = new SRTConverter();
                        const importResult = srtConverter.import(
                          { name: input.name + '.srt', type: 'text/plain', content: outputFileText, encoding: 'utf-8' },
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
                          const partiturOutpt = parConverter.export(importResult.annotjson, audioFile);

                          if (partiturOutpt.file) {
                            const file = new File([partiturOutpt.file.content], partiturOutpt.file.name, { type: partiturOutpt.file.type });
                            resolve({
                              name: file.name,
                              type: partiturOutpt.file.type,
                              size: file.size,
                              blob: file,
                              attributes: {
                                originalFileName: file.name,
                              },
                              hash: await getHashString(file),
                            });
                          }
                        } else {
                          reject(new Error("Can't import LST SRT output to AnnotjSON."));
                        }
                      }
                    } else {
                      reject(result.body.errorMessage);
                    }

                    await this.deleteLSTASRProject(httpClient, projectName, serviceProvider!);
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
  }

  private callG2PChunker(
    asrService: ServiceProvider,
    httpClient: HttpClient,
    asrResult: StoreFile,
    audioFile: StoreAudioFile,
    clonedOperation: ASROperation,
  ): Promise<StoreFile> {
    return new Promise<StoreFile>((resolve, reject) => {
      new Promise<string>((resolve2, reject2) => {
        UploadOperationFactory.upload([asrResult], AppSettings.getServiceInformation('BAS')!.host + 'uploadFileMulti', httpClient).subscribe({
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
        });
      })
        .then((asrURL) => {
          const url = this.commands[1]
            .replace('{{host}}', asrService.host)
            .replace('{{transcriptURL}}', asrURL)
            .replace('{{audioURL}}', audioFile?.url ?? '')
            .replace('{{asrType}}', `${asrService.provider}`)
            .replace('{{language}}', clonedOperation.options.language!);

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
                const currentRound = clonedOperation.lastRound!;
                // convert result to json
                const x2js = new X2JS();
                let json: any = x2js.xml2js(result);
                json = json.WebServiceResponseLink;

                if (json.success === 'true') {
                  const { extension } = extractFileNameFromURL(json.downloadLink);
                  const file = FileInfo.fromURL(json.downloadLink, 'text/plain', input.name + extension, Date.now());
                  setTimeout(() => {
                    file
                      .updateContentFromURL(httpClient)
                      .then(() => {
                        // add messages to protocol
                        if (json.warnings !== '') {
                          currentRound.protocol += '<br/>' + json.warnings.replace('¶', '');
                        } else if (json.output !== '') {
                          currentRound.protocol += '<br/>' + json.output.replace('¶', '');
                        }
                        resolve(file as StoreFile);
                      })
                      .catch((error) => {
                        reject(error);
                      });
                  }, 5000);
                } else {
                  reject(json.output);
                }
              },
              error: (error) => {
                reject(error.message);
              },
            });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  private async createLSTASRProject(httpClient: HttpClient, asrProvider: ServiceProvider) {
    return new Promise<string>((resolve, reject) => {
      const projectName = `tportal_session_${UUID.v7().replace(/-/g, '')}`;

      this.subscrManager.add(
        httpClient
          .post(
            joinURL(asrProvider.host, '/project/create'),
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
    });
  }

  private uploadFileToLST(file: StoreAudioFile, httpClient: HttpClient, projectName: string, serviceProvider: ServiceProvider) {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      if (file.blob) {
        // upload with file
        formData.append('file', file.blob, file.name);
      } else if (file.url) {
        // upload with URL
        formData.append('url', file.url);
        formData.append('basename', file.name);
      } else {
        reject(new Error('Missing file or URL for upload.'));
        return;
      }
      formData.append('projectName', projectName);
      httpClient.post(joinURL(serviceProvider.host, '/project/upload'), formData).subscribe({
        next: () => resolve(),
        error: reject,
      });
    });
  }

  async processASRLSTProject(httpclient: HttpClient, projectName: string, clonedOperation: ASROperation, serviceProvider: ServiceProvider) {
    return new Promise<void>((resolve, reject) => {
      if (clonedOperation.options.language) {
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
          });
      } else {
        reject(new Error('Missing language'));
      }
    });
  }

  private mapLanguageForLST(isoLanguage: string) {
    const mappings = {
      deu: 'de',
      nld: 'nl',
      ita: 'it',
      eng: 'en',
    };

    const parsed = /(.{3})-.*/g.exec(isoLanguage);
    if (parsed && parsed.length === 2) {
      if (Object.keys(mappings).includes(parsed[1])) {
        return (mappings as any)[parsed[1]];
      }
    }
  }

  getLSTProjectStatus(httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider) {
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
  }

  deleteLSTASRProject(httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider) {
    return new Promise<void>((resolve, reject) => {
      this.subscrManager.add(
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
  }
}
