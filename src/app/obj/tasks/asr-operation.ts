import {HttpClient} from '@angular/common/http';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {Task, TaskState} from './task';
import {AppInfo} from '../../app.info';
import * as X2JS from 'x2js';

export class ASROperation extends Operation {
  public webService = '';
  public resultType = 'BAS Partitur Format';

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, icon, task, state, id);
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

    /*
    // simulate upload
    setTimeout(() => {
      this.time.end = Date.now();
      const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/data/2018.01.15_09.40.12_40979BA89ADE5D8E1B72EA4CA03C9C73/test.par';
      this.results.push(FileInfo.fromURL(url));
      this.changeState(TaskState.FINISHED);
    }, 10000);
    */
  };

  public fromAny(operationObj: any, task: Task): Operation {
    const result = new ASROperation(operationObj.name, this.icon, task, operationObj.state, operationObj.id);
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
      let result = {
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
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new ASROperation(this.name, this.icon, selected_task, this.state);
  }
}
