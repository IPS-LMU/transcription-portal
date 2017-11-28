import { HttpClient } from '@angular/common/http';
import * as X2JS from 'x2js';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { TaskState } from './task';

export class ASROperation extends Operation {

  public constructor(name: string, icon?: string, state?: TaskState) {
    super(name, icon, state);
  }

  public start = (files: FileInfo[], httpclient: HttpClient) => {
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();

    const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runPipelineWebLink?' +
      ((files.length > 1) ? 'TEXT=' + files[ 1 ].url + '&' : '') +
      'SIGNAL=' + files[ 0 ].url + '&' +
      'PIPE=ASR_G2P_CHUNKER&LANGUAGE=deu-DE&' +
      'MAUSVARIANT=runPipeline&OUTFORMAT=bpf';

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
          console.log('FINISHED');
          console.log(this.state);
          this._time.end = Date.now();
        } else {
          console.error(json.output);
          this.changeState(TaskState.ERROR);
        }
      },
      (error) => {
        this.changeState(TaskState.ERROR);
        console.error(error);
      });
  }

  public clone(): ASROperation {
    return new ASROperation(this.name, this.icon, this.state);
  }
}
