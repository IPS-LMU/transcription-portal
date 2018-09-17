import {HttpClient} from '@angular/common/http';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {Task, TaskState} from '../tasks/task';
import {AppInfo} from '../../app.info';
import * as X2JS from 'x2js';

export class ASROperation extends Operation {
  public webService = '';
  public resultType = 'BAS Partitur Format';

  public constructor(name: string, title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, title, shortTitle, task, state, id);
    this._description = 'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.webService = `${AppInfo.getLanguageByCode(this.task.language).asr}ASR`;
    this._protocol = '';
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();

    const langObj = AppInfo.getLanguageByCode(this.task.language);

    const url = `${langObj.host}runPipelineWebLink?` +
      ((inputs.length > 1) ? 'TEXT=' + inputs[1].url + '&' : '') +
      `SIGNAL=${this.previousOperation.lastResult.url}&` +
      `PIPE=ASR_G2P_CHUNKER&ASRType=call${AppInfo.getLanguageByCode(this.task.language).asr}ASR&LANGUAGE=${this.task.language}&` +
      `MAUSVARIANT=runPipeline&OUTFORMAT=bpf`;

    httpclient.post(url, {}, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      responseType: 'text'
    }).subscribe((result: string) => {
        this.time.duration = Date.now() - this.time.start;

        // convert result to json
        const x2js = new X2JS();
        let json: any = x2js.xml2js(result);
        json = json.WebServiceResponseLink;

        // add messages to protocol
        if (json.warnings !== '') {
          this._protocol = json.warnings;
        } else if (json.output !== '') {
          this._protocol = json.output;
        }

        if (json.success === 'true') {
          const file = FileInfo.fromURL(json.downloadLink, inputs[0].name, 'text/plain');
          file.updateContentFromURL(httpclient).then(() => {
            this.results.push(file);
            this.changeState(TaskState.FINISHED);
          }).catch((error) => {
            this._protocol = error;
            this.changeState(TaskState.ERROR);
            console.error(this._protocol);
          });
        } else {
          this.changeState(TaskState.ERROR);
          console.error(this._protocol);
        }
      },
      (error) => {
        this._protocol = error.message;
        console.error(error);
        this.changeState(TaskState.ERROR);
      });
  }

  public fromAny(operationObj: any, task: Task): Operation {
    const result = new ASROperation(operationObj.name, this.title, this.shortTitle, task, operationObj.state, operationObj.id);
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

  public clone(task?: Task): ASROperation {
    const selected_task = ((task === null || task === undefined)) ? this.task : task;
    return new ASROperation(this.name, this.title, this.shortTitle, selected_task, this.state);
  }
}
