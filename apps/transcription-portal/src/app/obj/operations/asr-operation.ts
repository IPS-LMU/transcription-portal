import { HttpClient } from '@angular/common/http';
import { input } from '@angular/core';
import { PartiturConverter, SRTConverter } from '@octra/annotation';
import { ServiceProvider } from '@octra/ngx-components';
import { extractFileNameFromURL, joinURL, stringifyQueryParams, wait } from '@octra/utilities';
import { downloadFile } from '@octra/web-media';
import { interval, retry } from 'rxjs';
import * as UUID from 'uuid';
import * as X2JS from 'x2js';
import { environment } from '../../../environments/environment';
import { AppSettings } from '../../shared/app.settings';
import { Task, TaskStatus } from '../tasks';
import { TPortalAudioInfo, TPortalFileInfo } from '../TPortalFileInfoAttributes';
import { IOperation, Operation, OperationOptions, OperationProcessingRound } from './operation';
import { UploadOperation } from './upload-operation';

export interface IASROperation extends IOperation {
  language?: string;
  diarization?: {
    enabled?: boolean;
    speakers?: number;
  };
}

export class ASROperation extends Operation {
  public resultType = 'BAS Partitur Format';
  protected _language?: string;
  get language(): string | undefined {
    return this._language;
  }

  set language(value: string | undefined) {
    this._language = value;
  }

  diarization?: {
    enabled?: boolean;
    speakers?: number;
  };

  public start = async (inputs: (TPortalFileInfo | TPortalAudioInfo)[], operations: Operation[], httpclient: HttpClient, accessCode?: string) => {
    this.updateProtocol('');

    if (!this.lastRound) {
      this.addProcessingRound();
    }

    this.changeState(TaskStatus.PROCESSING);
    await wait(2);
    const currentRound = this.lastRound!;
    currentRound.time = {
      start: Date.now(),
    };

    if (this.serviceProvider) {
      try {
        let asrResult: TPortalFileInfo | undefined;
        if (this.serviceProvider.provider === 'LSTWhisperX') {
          asrResult = await this.callASRFromRadboud(httpclient, inputs[0] as TPortalAudioInfo, accessCode);
        } else {
          asrResult = await this.callASRFromBASWebservices(httpclient, inputs[0] as TPortalAudioInfo, accessCode);
        }

        if (asrResult && this.serviceProvider) {
          const g2pChunkerNeeded =
            (this.task?.operations[2]?.name === 'OCTRA' &&
              this.task?.operations[2]?.enabled === false &&
              this.task?.operations[3]?.name === 'MAUS' &&
              this.task?.operations[3]?.enabled === false) ||
            this.task?.operations[3]?.name === 'SUMMARIZATION' ||
            (!this.diarization?.enabled && this.serviceProvider.provider === 'Google');
          // use G2P_CHUNKER only if Octra and Word alignment is disabled or summarization mode or if service provider is Google and diarization disabled

          try {
            if (g2pChunkerNeeded) {
              asrResult = await this.callG2PChunker(AppSettings.getServiceInformation('BAS')!, httpclient, asrResult);
            }

            this.time!.duration = Date.now() - this.time!.start;

            if (asrResult.file) {
              const name = (inputs[0].attributes?.originalFileName ?? inputs[0].fullname).replace(/\.[^.]+$/g, '');

              asrResult.attributes = {
                originalFileName: `${name}${asrResult.extension}`,
              };
              currentRound.results.push(asrResult);
              this.changeState(TaskStatus.FINISHED);
            } else {
              throw new Error('Missing result for ASR.');
            }
          } catch (e: any) {
            this.throwError(e);
          }
        }
      } catch (e: any) {
        this.throwError(e);
      }
    } else {
      this.updateProtocol(this.protocol + '<br/>' + 'serviceProvider is undefined');
      this.time!.duration = Date.now() - this.time!.start;
      this.changeState(TaskStatus.ERROR);
      console.error('serviceProvider is undefined');
    }
  };

  public clone(task?: Task, id?: number): ASROperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new ASROperation(this.name, this._commands, this.title, this.shortTitle, selectedTask, id, this.serviceProvider, this.language);
  }

  public fromAny(operationObj: IASROperation, commands: string[], task: Task): Operation {
    const result = new ASROperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider),
      operationObj.language,
    );
    result.diarization = operationObj.diarization;

    for (const roundObj of operationObj.rounds) {
      result.rounds.push(OperationProcessingRound.fromAny(roundObj));
    }
    result.enabled = operationObj.enabled;
    result.parseProtocol();

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
    this._description =
      'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  private callASRFromBASWebservices(httpClient: HttpClient, input: TPortalAudioInfo, accessCode?: string): Promise<TPortalFileInfo> {
    return new Promise<TPortalFileInfo>((resolve, reject) => {
      if (this.serviceProvider) {
        let url =
          this._commands[0]
            .replace('{{host}}', this.serviceProvider.host)
            .replace('{{audioURL}}', this.previousOperation?.lastRound?.lastResult?.url ?? '')
            .replace('{{asrType}}', this.serviceProvider.provider!)
            .replace('{{language}}', this.language!) + `&diarization=${this.diarization?.enabled ?? false}`;

        if (this.diarization?.enabled && this.diarization?.speakers) {
          url += `&numberSpeakDiar=${this.diarization.speakers}`;
        }

        if (accessCode && accessCode !== '') {
          url += `&ACCESSCODE=${accessCode}`;
        }

        httpClient
          .post(
            url,
            {},
            {
              headers: {
                ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
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
                const file = TPortalFileInfo.fromURL(json.downloadLink, 'text/plain', input.name + extension, Date.now()) as TPortalFileInfo;
                file
                  .updateContentFromURL(httpClient)
                  .then((content) => {
                    // add messages to protocol
                    if (json.warnings !== '') {
                      this.updateProtocol(this.protocol + '<br/>' + json.warnings.replace('¶', ''));
                    } else if (json.output !== '') {
                      this.updateProtocol(this.protocol + '<br/>' + json.output.replace('¶', ''));
                    }

                    resolve(file);
                  })
                  .catch((error) => {
                    reject(new Error(error?.error?.message ?? error?.message ?? error));
                  });
              } else {
                reject(new Error(json.output));
              }
            },
            error: (error) => {
              reject(new Error(error?.error?.message ?? error?.message ?? error));
            },
          });
      } else {
        reject(new Error('Missing ASR Provider.'));
      }
    });
  }

  private async callASRFromRadboud(httpClient: HttpClient, input: TPortalAudioInfo, accessCode?: string): Promise<TPortalFileInfo> {
    if (this.serviceProvider) {
      if (input) {
        // 1. Create a new project with unique ID
        const projectName = await this.createLSTASRProject(httpClient, this.serviceProvider);
        await wait(1);
        // 2. Upload files
        await this.uploadFileToLST(input, httpClient, projectName, this.serviceProvider);

        const res = await this.processASRLSTProject(httpClient, projectName, this.serviceProvider);

        return new Promise<TPortalFileInfo>((resolve, reject) => {
          this.subscrManager.add(
            interval(5000).subscribe({
              next: async () => {
                if (this.serviceProvider) {
                  const result = await this.getLSTProjectStatus(httpClient, projectName, this.serviceProvider);

                  if (result.status === 'success' && result.body.status === 'finished') {
                    this.subscrManager.removeByTag('status check');
                    if (!result.body.errors) {
                      this.time!.duration = Date.now() - this.time!.start;

                      const outputFile = result.body.outputs.find((o: any) => o.template === 'SRT');

                      if (outputFile) {
                        const outputFileText = (await downloadFile(outputFile.url, 'text')) as any as string;

                        const srtConverter = new SRTConverter();
                        const audioFile = this.task?.files.find((a) => a.type.includes('audio')) as TPortalAudioInfo;
                        const importResult = srtConverter.import(
                          { name: input.name + '.srt', type: 'text/plain', content: outputFileText, encoding: 'utf-8' },
                          audioFile,
                          this.diarization?.enabled
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
                            resolve(new TPortalFileInfo(file.name, partiturOutpt.file.type, file.size, file));
                          }
                        } else {
                          reject(new Error("Can't import LST SRT output to AnnotjSON."));
                        }
                      }

                      // only delete project on success
                      await this.deleteLSTASRProject(httpClient, projectName, this.serviceProvider);
                    } else {
                      const errorLog = result.body.outputs.find((o: any) => o.template === 'errorlog');
                      try {
                        const errorText = (await downloadFile(errorLog.url, 'text')) as unknown as string;
                        console.error(new Error(`CLST RADBOUD ASR ERROR:\n${errorText}`));
                      } catch (e) {
                        console.error(new Error(`Can't download error.log from ${errorLog?.url}`));
                        console.error(e);
                      }
                      reject(new Error(`Error from CLST Radboud ASR: ${result.body.errorMessage}\nERROR: CLST ASRService Projectname: ${projectName}`));
                    }
                  }
                }
              },
            }),
            'status check',
          );
        });
      } else {
        throw new Error('Missing input file.');
      }
    } else {
      throw new Error('Missing ASR Provider.');
    }
  }

  private callG2PChunker(asrService: ServiceProvider, httpClient: HttpClient, asrResult: TPortalFileInfo): Promise<TPortalFileInfo> {
    return new Promise<TPortalFileInfo>((resolve, reject) => {
      new Promise<string>((resolve2, reject2) => {
        UploadOperation.upload([asrResult], AppSettings.getServiceInformation('BAS')!.host + 'uploadFileMulti', httpClient).subscribe({
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
          const url = this._commands[1]
            .replace('{{host}}', asrService.host)
            .replace('{{transcriptURL}}', asrURL)
            .replace('{{audioURL}}', this.previousOperation?.lastRound?.lastResult?.url ?? '')
            .replace('{{asrType}}', `${asrService.provider}`)
            .replace('{{language}}', this.language!);

          httpClient
            .post(
              url,
              {},
              {
                headers: {
                  ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
                  'Content-Type': 'multipart/form-data',
                },
                responseType: 'text',
              },
            )
            .subscribe(
              (result: string) => {
                // convert result to json
                const x2js = new X2JS();
                let json: any = x2js.xml2js(result);
                json = json.WebServiceResponseLink;

                if (json.success === 'true') {
                  const { extension } = extractFileNameFromURL(json.downloadLink);
                  const file = TPortalFileInfo.fromURL(json.downloadLink, 'text/plain', input.name + extension, Date.now());
                  setTimeout(() => {
                    file
                      .updateContentFromURL(httpClient)
                      .then(() => {
                        // add messages to protocol
                        if (json.warnings !== '') {
                          this.updateProtocol('<br/>' + json.warnings.replace('¶', ''));
                        } else if (json.output !== '') {
                          this.updateProtocol('<br/>' + json.output.replace('¶', ''));
                        }
                        resolve(file as TPortalFileInfo);
                      })
                      .catch((error) => {
                        reject(new Error(error?.error?.message ?? error?.message ?? error));
                      });
                  }, 5000);
                } else {
                  reject(new Error(json.output));
                }
              },
              (error) => {
                reject(new Error(error?.error?.message ?? error?.message ?? error));
              },
            );
        })
        .catch((error) => {
          reject(new Error(error?.error?.message ?? error?.message ?? error));
        });
    });
  }

  getLSTProjectStatus(httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider) {
    return new Promise<any>((resolve, reject) => {
      this.subscrManager.add(
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
            {
              responseType: 'json',
              headers: {
                ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
              },
            },
          )
          .pipe(retry(3))
          .subscribe({
            next: () => {
              resolve(projectName);
            },
            error: reject,
          }),
      );
    });
  }

  private uploadFileToLST(file: TPortalAudioInfo, httpClient: HttpClient, projectName: string, serviceProvider: ServiceProvider) {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      if (file.file) {
        // upload with file
        formData.append('file', file.file, file.name);
      } else if (file.url) {
        // upload with URL
        formData.append('url', file.url);
        formData.append('basename', file.name);
      } else {
        reject(new Error('Missing file or URL for upload.'));
        return;
      }
      formData.append('projectName', projectName);
      this.subscrManager.add(
        httpClient
          .post(joinURL(serviceProvider.host, '/project/upload'), formData, {
            headers: {
              ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
            },
          })
          .subscribe({
            next: () => resolve(),
            error: reject,
          }),
      );
    });
  }

  async processASRLSTProject(httpclient: HttpClient, projectName: string, serviceProvider: ServiceProvider) {
    return new Promise<void>((resolve, reject) => {
      if (this.language) {
        this.subscrManager.add(
          httpclient
            .post(
              joinURL(serviceProvider.host, '/project/process'),
              {
                projectName,
                language: this.mapLanguageForLST(this.language),
                gpu: true,
                diarization: this.diarization?.enabled ?? false,
                minspeakers: this.diarization?.enabled ? this.diarization?.speakers : undefined,
                maxspeakers: this.diarization?.enabled ? this.diarization?.speakers : undefined,
              },
              {
                responseType: 'json',
                headers: {
                  ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
                },
              },
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

  override overwriteOptions(options: OperationOptions) {
    this._serviceProvider = options.asr?.provider;
    this._language = options.asr?.language;
    this.diarization = options.asr?.diarization;
  }

  override async toAny(): Promise<IASROperation> {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      rounds: await this.serializeProcessingRounds(),
      serviceProvider: this.serviceProvider?.provider,
      language: this.language,
      diarization: this.diarization,
    };
  }
}
