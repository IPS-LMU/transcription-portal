import {HttpClient} from '@angular/common/http';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {Task, TaskState} from '../tasks/task';
import * as X2JS from 'x2js';
import {OHLanguageObject} from '../oh-config';

export class ASROperation extends Operation {
  public webService = '';
  public resultType = 'BAS Partitur Format';

  public constructor(name: string, commands: string[], title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description = 'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  public start = (languageObject: OHLanguageObject, inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.webService = `${languageObject.asr}ASR`;
    this._protocol = '';
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();

    this.callASR(languageObject, httpclient, inputs[0]).then((file: FileInfo) => {
      if (!(file === null || file === undefined)) {
        this.callG2PChunker(languageObject, httpclient, file).then((finalResult) => {
          this.time.duration = Date.now() - this.time.start;

          this.results.push(finalResult);
          this.changeState(TaskState.FINISHED);
        }).catch((error) => {
          this._protocol += '<br/>' + error;
          this.changeState(TaskState.ERROR);
          console.error(error);
        });
      }
    }).catch((error) => {
      this._protocol += '<br/>' + error;
      this.changeState(TaskState.ERROR);
      console.error(error);
    });
  }

  public fromAny(operationObj: any, commands: string[], task: Task): Operation {
    const result = new ASROperation(operationObj.name, commands, this.title,
      this.shortTitle, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const resultObj = operationObj.results[k];
      const resultClass = FileInfo.fromAny(resultObj);
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result._protocol = operationObj.protocol;
    result.enabled = operationObj.enabled;
    result.webService = operationObj.webService;
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

  private callASR(languageObject: OHLanguageObject, httpClient: HttpClient, input: any): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      this.webService = `${languageObject.asr}ASR`;

      const url = this._commands[0].replace('{{host}}', languageObject.host)
        .replace('{{audioURL}}', this.previousOperation.lastResult.url)
        .replace('{{asrType}}', languageObject.asr)
        .replace('{{language}}', this.task.language);

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
            const file = FileInfo.fromURL(json.downloadLink, input.name, 'text/plain');
            file.updateContentFromURL(httpClient).then(() => {
              // add messages to protocol
              if (json.warnings !== '') {
                this._protocol += '<br/>' + json.warnings;
              } else if (json.output !== '') {
                this._protocol = '<br/>' + json.output;
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
      this.webService = `${languageObject.asr}ASR`;

      const url = this._commands[1].replace('{{host}}', languageObject.host)
        .replace('{{transcriptURL}}', asrResult.url)
        .replace('{{audioURL}}', this.previousOperation.lastResult.url)
        .replace('{{asrType}}', languageObject.asr)
        .replace('{{language}}', this.task.language);

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
            file.updateContentFromURL(httpClient).then(() => {
              // add messages to protocol
              if (json.warnings !== '') {
                this._protocol = '<br/>' + json.warnings;
              } else if (json.output !== '') {
                this._protocol = '<br/>' + json.output;
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

  public clone(task?: Task): ASROperation {
    const selected_task = ((task === null || task === undefined)) ? this.task : task;
    return new ASROperation(this.name, this._commands, this.title, this.shortTitle, selected_task, this.state);
  }
}
