import { HttpClient } from '@angular/common/http';
import * as X2JS from 'x2js';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { TaskState } from './task';

export class MAUSOperation extends Operation {

  public constructor(name: string, icon?: string, state?: TaskState) {
    super(name, icon, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();
    try {
      const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runMAUSWebLink?' +
        'BPF=' + inputs[ 1 ].url +
        '&SIGNAL=' + inputs[ 0 ].url +
        '&MAUSVARIANT=runMAUS&OUTFORMAT=emuDB';

      httpclient.post(url, {}, {
        headers     : {
          'Content-Type': 'multipart/form-data'
        },
        responseType: 'text'
      }).subscribe((result: string) => {
          // convert result to json
          const x2js = new X2JS();
          let json: any = x2js.xml2js(result);
          json = json.WebServiceResponseLink;
          console.log(json);

          if (json.success === 'true') {
            this.changeState(TaskState.FINISHED);
            console.log('FINISHED MAUS');
            console.log(this.state);
            this._time.end = Date.now();
            this.results.push(FileInfo.fromURL(json.downloadLink));
            console.log(this.results);
          } else {
            console.error(json.output);
            this.changeState(TaskState.ERROR);
          }

          // add messages to protocol
          if (json.warnings !== '') {
            this._protocol = json.warnings;
          }
        },
        (error) => {
          this._protocol = error.message;
          this.changeState(TaskState.ERROR);
          console.error(error);
        });
    } catch (e) {
      this._protocol = e.message;
      this.changeState(TaskState.ERROR);
    }
  };

  public clone(): MAUSOperation {
    return new MAUSOperation(this.name, this.icon, this.state);
  }
}
