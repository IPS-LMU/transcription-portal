import { HttpClient } from '@angular/common/http';
import { isNullOrUndefined } from 'util';
import * as X2JS from 'x2js';
import { AppInfo } from '../../../app.info';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { Task, TaskState } from './task';

export class ASROperation extends Operation {

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState) {
    super(name, icon, task, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();
    this._time.end = 0;
    const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runPipelineWebLink?' +
      ((inputs.length > 1) ? 'TEXT=' + inputs[ 1 ].url + '&' : '') +
      'SIGNAL=' + inputs[ 0 ].url + '&' +
      'PIPE=ASR_G2P_CHUNKER&ASRType=call' + AppInfo.getLanguageByCode(this.task.language).asr + 'ASR&LANGUAGE=' + this.task.language + '&' +
      'MAUSVARIANT=runPipeline&OUTFORMAT=bpf';

    httpclient.post(url, {}, {
      headers     : {
        'Content-Type': 'multipart/form-data'
      },
      responseType: 'text'
    }).subscribe((result: string) => {
        this._time.end = Date.now();

        // convert result to json
        const x2js = new X2JS();
        let json: any = x2js.xml2js(result);
        json = json.WebServiceResponseLink;
        console.log(json);

        if (json.success === 'true') {
          this.results.push(FileInfo.fromURL(json.downloadLink, inputs[ 0 ].name));
          console.log(this.results);
          this.changeState(TaskState.FINISHED);
        } else {
          this.changeState(TaskState.ERROR);
        }

        // add messages to protocol
        if (json.warnings !== '') {
          this._protocol = json.warnings;
        } else if (json.output !== '') {
          this._protocol = json.output;
        }
      },
      (error) => {
        this._protocol = error.message;
        console.log(error);
        this.changeState(TaskState.ERROR);
      });
  };

  public clone(task?: Task): ASROperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new ASROperation(this.name, this.icon, selected_task, this.state);
  }
}
