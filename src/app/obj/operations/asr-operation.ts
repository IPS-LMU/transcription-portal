import {HttpClient} from '@angular/common/http';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {Task, TaskState} from '../tasks/task';
import * as X2JS from 'x2js';
import {OHLanguageObject} from '../oh-config';
import {UploadOperation} from './upload-operation';
import {AppSettings} from '../../shared/app.settings';

export class ASROperation extends Operation {
  public webService = '';
  public resultType = 'BAS Partitur Format';

  public constructor(name: string, commands: string[], title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description = 'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  public start = (languageObject: OHLanguageObject, inputs: FileInfo[], operations: Operation[], httpclient: HttpClient, accessCode: string) => {
    this.webService = languageObject.asr;
    this.updateProtocol('');
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();

    setTimeout(() => {
      this.callASR(languageObject, httpclient, inputs[0], accessCode).then((file: FileInfo) => {
        if (!(file === null || file === undefined)) {
          this.callG2PChunker(languageObject, httpclient, file).then((finalResult) => {
            this.time.duration = Date.now() - this.time.start;

            this.results.push(finalResult);
            this.changeState(TaskState.FINISHED);
          }).catch((error) => {
            this.updateProtocol(this.protocol + '<br/>' + error.replace('¶'));
            this.time.duration = Date.now() - this.time.start;
            this.changeState(TaskState.ERROR);
            console.error(error);
          });
        }
      }).catch((error) => {
        this.updateProtocol(this.protocol + '<br/>' + error.replace('¶'));
        this.time.duration = Date.now() - this.time.start;
        this.changeState(TaskState.ERROR);
        console.error(error);
      });
    }, 2000);
  };

  public fromAny(operationObj: any, commands: string[], task: Task): Operation {
    const result = new ASROperation(operationObj.name, commands, this.title,
      this.shortTitle, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const resultObj = operationObj.results[k];
      const resultClass = FileInfo.fromAny(resultObj);
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result.updateProtocol(operationObj.protocol.replace('¶'));
    result.enabled = operationObj.enabled;
    result.webService = operationObj.webService.replace('ASR', '');

    if (!(operationObj.serviceProvider === null || operationObj.serviceProvider === undefined)) {
      result._providerInformation = AppSettings.getServiceInformation(operationObj.serviceProvider);
      console.log(`loaded ASR: ${result._providerInformation.provider}`);
    } else {
      const providerName = operationObj.webService.replace('ASR', '');

      if (providerName !== '') {
        result._providerInformation = AppSettings.getServiceInformation(providerName);
        console.log(`provider not available, set ${result._providerInformation.provider}`);
      }
    }

    return result;
  }

  toAny(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const result = {
        id: this.id,
        name: this.name,
        state: this.state,
        protocol: this.protocol,
        time: this.time,
        enabled: this.enabled,
        webService: this.webService,
        serviceProvider: (!(this._providerInformation === null || this._providerInformation === undefined)) ? this._providerInformation.provider : undefined,
        results: []
      };

      // result data
      const promises: Promise<any>[] = [];
      for (let i = 0; i < this.results.length; i++) {
        const resultObj = this.results[i];
        promises.push(resultObj.toAny());
      }

      if (promises.length > 0) {
        Promise.all(promises).then((values) => {
          result.results = values;
          resolve(result);
        }).catch((error) => {
          reject(error);
        });
      } else {
        resolve(result);
      }
    });
  }

  private callASR(languageObject: OHLanguageObject, httpClient: HttpClient, input: any, accessCode: string): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      this.webService = languageObject.asr;

      let url = this._commands[0].replace('{{host}}', languageObject.host)
        .replace('{{audioURL}}', this.previousOperation.lastResult.url)
        .replace('{{asrType}}', languageObject.asr)
        .replace('{{language}}', this.task.language);

      if (accessCode !== '') {
        url += `&ACCESSCODE=${accessCode}`;
      }

      console.log(`Call ${languageObject.asr}ASR:`);
      console.log(url);
      httpClient.post(url, {}, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'text'
      }).subscribe((result: string) => {
          console.log(`XML Result:`);
          console.log(result);
          // convert result to json
          const x2js = new X2JS();
          let json: any = x2js.xml2js(result);
          json = json.WebServiceResponseLink;

          if (json.success === 'true') {
            const file = FileInfo.fromURL(json.downloadLink, input.name, 'text/plain');
            file.updateContentFromURL(httpClient).then(() => {
              // add messages to protocol
              if (json.warnings !== '') {
                this.updateProtocol(this.protocol + '<br/>' + json.warnings.replace('¶'));
              } else if (json.output !== '') {
                this.updateProtocol(this.protocol + '<br/>' + json.output.replace('¶'));
              }
              resolve(file);
            }).catch((error) => {
              reject(error);
            });
          } else {
            reject(json.output);
          }
        },
        (error) => {
          reject(error.message);
        });
    });
  }

  private callG2PChunker(languageObject: OHLanguageObject, httpClient: HttpClient, asrResult: FileInfo): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {

      new Promise<string>((resolve2, reject2) => {
        UploadOperation.upload([asrResult], languageObject.host + 'uploadFileMulti', httpClient).subscribe(
          (event) => {
            if (event.type === 'loadend') {
              const result = <string>event.result;
              const x2js = new X2JS();
              let json: any = x2js.xml2js(result);
              json = json.UploadFileMultiResponse;

              let url = '';

              if (Array.isArray(json.fileList.entry)) {
                url = json.fileList.entry[0].value;
              } else {
                // json attribute entry is an object
                url = json.fileList.entry['value'];
              }

              resolve2(url);
            }
          },
          (error) => {
            reject2(error);
          }
        );
      }).then((asrURL) => {
        console.log(`CALL G2P ${asrURL}`);
        this.webService = languageObject.asr;

        const url = this._commands[1].replace('{{host}}', languageObject.host)
          .replace('{{transcriptURL}}', asrURL)
          .replace('{{audioURL}}', this.previousOperation.lastResult.url)
          .replace('{{asrType}}', `${languageObject.asr}`)
          .replace('{{language}}', this.task.language);


        console.log(`Call G2P_CHUNKER:`);
        console.log(url);

        httpClient.post(url, {}, {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          responseType: 'text'
        }).subscribe((result: string) => {
            // convert result to json
            const x2js = new X2JS();
            let json: any = x2js.xml2js(result);
            json = json.WebServiceResponseLink;

            if (json.success === 'true') {
              const file = FileInfo.fromURL(json.downloadLink, asrResult.name, 'text/plain');

              setTimeout(() => {
                file.updateContentFromURL(httpClient).then(() => {
                  // add messages to protocol
                  if (json.warnings !== '') {
                    this.updateProtocol('<br/>' + json.warnings.replace('¶'));
                  } else if (json.output !== '') {
                    this.updateProtocol('<br/>' + json.output.replace('¶'));
                  }
                  resolve(file);
                }).catch((error) => {
                  reject(error);
                });
              }, 5000);
            } else {
              reject(json.output);
            }
          },
          (error) => {
            reject(error.message);
          });
      }).catch((error) => {
        reject(error);
      });
    });
  }

  public clone(task?: Task): ASROperation {
    const selected_task = ((task === null || task === undefined)) ? this.task : task;
    return new ASROperation(this.name, this._commands, this.title, this.shortTitle, selected_task, this.state);
  }
}
