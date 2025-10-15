import { HttpClient } from '@angular/common/http';
import { input } from '@angular/core';
import { ServiceProvider } from '@octra/ngx-components';
import {
  extractFileNameFromURL,
  joinURL,
  stringifyQueryParams,
  wait,
} from '@octra/utilities';
import { downloadFile, FileInfo } from '@octra/web-media';
import { interval } from 'rxjs';
import * as UUID from 'uuid';
import * as X2JS from 'x2js';
import { AppSettings } from '../../shared/app.settings';
import { Task, TaskStatus } from '../tasks';
import { IOperation, Operation } from './operation';
import { UploadOperation } from './upload-operation';

export class ASROperation extends Operation {
  public resultType = 'BAS Partitur Format';

  public start = (
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode?: string,
  ) => {
    this.updateProtocol('');
    this.changeState(TaskStatus.PROCESSING);
    this._time.start = Date.now();

    setTimeout(() => {
      if (this.serviceProvider) {
        const promise: Promise<FileInfo> =
          this.serviceProvider.provider === 'LSTWhisperX'
            ? this.callASRFromRadboud(httpclient, inputs[0], accessCode)
            : this.callASRFromBASWebservices(httpclient, inputs[0], accessCode);

        promise
          .then((file: FileInfo) => {
            if (file && this.serviceProvider) {
              this.callG2PChunker(AppSettings.getServiceInformation("BAS")!, httpclient, file)
                .then((finalResult) => {
                  this.time.duration = Date.now() - this.time.start;

                  if (finalResult.file) {
                    const name = (
                      inputs[0].attributes?.originalFileName ??
                      inputs[0].fullname
                    ).replace(/\.[^.]+$/g, '');

                    finalResult.attributes = {
                      originalFileName: `${name}${finalResult.extension}`,
                    };
                    this.results.push(finalResult);
                    this.changeState(TaskStatus.FINISHED);
                  } else {
                    this.changeState(TaskStatus.ERROR);
                  }
                })
                .catch((error) => {
                  this.updateProtocol(
                    this.protocol + '<br/>' + error.replace('¶', ''),
                  );
                  this.time.duration = Date.now() - this.time.start;
                  this.changeState(TaskStatus.ERROR);
                  console.error(error);
                });
            }
          })
          .catch((error) => {
            this.updateProtocol(
              this.protocol + '<br/>' + error.replace('¶', ''),
            );
            this.time.duration = Date.now() - this.time.start;
            this.changeState(TaskStatus.ERROR);
            console.error(error);
          });
      } else {
        this.updateProtocol(
          this.protocol + '<br/>' + 'serviceProvider is undefined',
        );
        this.time.duration = Date.now() - this.time.start;
        this.changeState(TaskStatus.ERROR);
        console.error('serviceProvider is undefined');
      }
    }, 2000);
  };

  public clone(task?: Task): ASROperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new ASROperation(
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
    taskObj: any,
  ): Operation {
    const result = new ASROperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider) ??
        AppSettings.getServiceInformation(taskObj.asrProvider),
      operationObj.language ?? taskObj.asrLanguage,
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
    this._description =
      'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  private callASRFromBASWebservices(
    httpClient: HttpClient,
    input: FileInfo,
    accessCode?: string,
  ): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      if (this.serviceProvider) {
        let url =
          this._commands[0]
            .replace('{{host}}', this.serviceProvider.host)
            .replace(
              '{{audioURL}}',
              this.previousOperation?.lastResult?.url ?? '',
            )
            .replace('{{asrType}}', this.serviceProvider.provider!)
            .replace('{{language}}', this.language!) + '&diarization=false';

        if (accessCode && accessCode !== '') {
          url += `&ACCESSCODE=${accessCode}`;
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
              // convert result to json
              const x2js = new X2JS();
              let json: any = x2js.xml2js(result);
              json = json.WebServiceResponseLink;

              if (json.success === 'true') {
                const { extension } = extractFileNameFromURL(json.downloadLink);
                const file = FileInfo.fromURL(
                  json.downloadLink,
                  'text/plain',
                  input.name + extension,
                  Date.now(),
                );
                file
                  .updateContentFromURL(httpClient)
                  .then(() => {
                    // add messages to protocol
                    if (json.warnings !== '') {
                      this.updateProtocol(
                        this.protocol +
                          '<br/>' +
                          json.warnings.replace('¶', ''),
                      );
                    } else if (json.output !== '') {
                      this.updateProtocol(
                        this.protocol + '<br/>' + json.output.replace('¶', ''),
                      );
                    }
                    resolve(file);
                  })
                  .catch((error) => {
                    reject(error);
                  });
              } else {
                reject(json.output);
              }
            },
            error: (error) => {
              reject(error.message);
            },
          });
      } else {
        this.throwError(new Error('Missing ASR Provider.'));
      }
    });
  }

  private async callASRFromRadboud(
    httpClient: HttpClient,
    input: FileInfo,
    accessCode?: string,
  ): Promise<FileInfo> {
    if (this.serviceProvider) {
      if (input.file) {
        // 1. Create a new project with unique ID
        const projectName = await this.createLSTASRProject(
          httpClient,
          this.serviceProvider,
        );
        await wait(1);
        // 2. Upload files
        await this.uploadFileToLST(
          input.file,
          httpClient,
          projectName,
          this.serviceProvider,
        );

        const res = await this.processASRLSTProject(
          httpClient,
          projectName,
          this.serviceProvider,
        );

        return new Promise<FileInfo>((resolve, reject) => {
          this.subscrManager.add(
            interval(5000).subscribe({
              next: async () => {
                if (this.serviceProvider) {
                  const result = await this.getLSTProjectStatus(
                    httpClient,
                    projectName,
                    this.serviceProvider,
                  );

                  if (
                    result.status === 'success' &&
                    result.body.status === 'finished'
                  ) {
                    if (!result.body.errors) {
                      this.time.duration = Date.now() - this.time.start;

                      const outputFile = result.body.outputs.find(
                        (o: any) => o.template === 'Transcription',
                      );

                      if (outputFile) {
                        const outputFileText = await downloadFile(
                          outputFile.url,
                          'text',
                        ) as any as string;
                        const file = new File(
                          [outputFileText.replace(/\n/g, " ").replace(/\s+/g, " ")],
                          input.name + '.txt',
                          { type: 'text/plain' },
                        );
                        resolve(
                          new FileInfo(
                            file.name,
                            'text/plain',
                            file.size,
                            file,
                          ),
                        );
                      }
                    } else {
                      reject(result.body.errorMessage);
                    }

                    this.subscrManager.removeByTag('status check');
                    await this.deleteLSTASRProject(
                      httpClient,
                      projectName,
                      this.serviceProvider,
                    );
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

  private callG2PChunker(
    asrService: ServiceProvider,
    httpClient: HttpClient,
    asrResult: FileInfo,
  ): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      new Promise<string>((resolve2, reject2) => {
        UploadOperation.upload(
          [asrResult],
          AppSettings.getServiceInformation('BAS')!.host + 'uploadFileMulti',
          httpClient,
        ).subscribe({
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
            .replace(
              '{{audioURL}}',
              this.previousOperation?.lastResult?.url ?? '',
            )
            .replace('{{asrType}}', `${asrService.provider}`)
            .replace('{{language}}', this.language!);

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
            .subscribe(
              (result: string) => {
                // convert result to json
                const x2js = new X2JS();
                let json: any = x2js.xml2js(result);
                json = json.WebServiceResponseLink;

                if (json.success === 'true') {
                  const { extension } = extractFileNameFromURL(
                    json.downloadLink,
                  );
                  const file = FileInfo.fromURL(
                    json.downloadLink,
                    'text/plain',
                    input.name + extension,
                    Date.now(),
                  );
                  setTimeout(() => {
                    file
                      .updateContentFromURL(httpClient)
                      .then(() => {
                        // add messages to protocol
                        if (json.warnings !== '') {
                          this.updateProtocol(
                            '<br/>' + json.warnings.replace('¶', ''),
                          );
                        } else if (json.output !== '') {
                          this.updateProtocol(
                            '<br/>' + json.output.replace('¶', ''),
                          );
                        }
                        resolve(file);
                      })
                      .catch((error) => {
                        reject(error);
                      });
                  }, 5000);
                } else {
                  reject(json.output);
                }
              },
              (error) => {
                reject(error.message);
              },
            );
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  getLSTProjectStatus(
    httpclient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
  ) {
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

  deleteLSTASRProject(
    httpclient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
  ) {
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

  private async createLSTASRProject(
    httpClient: HttpClient,
    asrProvider: ServiceProvider,
  ) {
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

  private uploadFileToLST(
    file: File,
    httpClient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
  ) {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('projectName', projectName);
      this.subscrManager.add(
        httpClient
          .post(joinURL(serviceProvider.host, '/project/upload'), formData)
          .subscribe({
            next: () => resolve(),
            error: reject,
          }),
      );
    });
  }

  async processASRLSTProject(
    httpclient: HttpClient,
    projectName: string,
    serviceProvider: ServiceProvider,
  ) {
    return new Promise<void>((resolve, reject) => {
      if (this.language) {
        this.subscrManager.add(
          httpclient
            .post(
              joinURL(serviceProvider.host, '/project/process'),
              {
                projectName,
                language: this.mapLanguageForLST(this.language),
                gpu: true
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
}
