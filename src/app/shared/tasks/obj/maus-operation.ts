import { HttpClient } from '@angular/common/http';
import { isNullOrUndefined } from 'util';
import * as X2JS from 'x2js';
import { FileInfo } from './fileInfo';
import { Task } from './index';
import { Operation } from './operation';
import { TaskState } from './task';

export class MAUSOperation extends Operation {

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState) {
    super(name, icon, task, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();
    this._time.end = 0;

    try {
      console.log('results');
      console.log(operations[ 1 ].results);
      const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runMAUSWebLink?' +
        'BPF=' + operations[ 1 ].results[ 0 ].url +
        '&SIGNAL=' + inputs[ 0 ].url +
        '&LANGUAGE=deu-DE' +
        '&OUTFORMAT=emuDB&MAUSVARIANT=runMAUS';

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);

      xhr.onloadstart = (e) => {
        console.log('start');
      };

      xhr.onerror = (e) => {
        console.error(e);
        // add messages to protocol
        this._protocol = e.message;
        this.changeState(TaskState.ERROR);
      };

      xhr.onloadend = (e) => {
        this.time.end = Date.now();
        const result = e.currentTarget[ 'responseText' ];
        const x2js = new X2JS();
        let json: any = x2js.xml2js(result);
        json = json.WebServiceResponseLink;
        console.log(json);

        // add messages to protocol
        if (json.warnings !== '') {
          this._protocol = json.warnings;
        } else if (json.output !== '') {
          this._protocol = json.output;
        }

        if (json.success === 'true') {
          this.time.end = Date.now();
          this.results.push(FileInfo.fromURL(json.downloadLink));
          this.changeState(TaskState.FINISHED);
        } else {
          this.changeState(TaskState.ERROR);
          console.error(json[ 'message' ]);
        }
      };
      xhr.send();
    } catch (e) {
      this._protocol = e.message;
      this.changeState(TaskState.ERROR);
    }
  };

  public clone(task?: Task): MAUSOperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new MAUSOperation(this.name, this.icon, selected_task, this.state);
  }
}
