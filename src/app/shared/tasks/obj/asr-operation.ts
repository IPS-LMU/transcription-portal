import { HttpClient } from '@angular/common/http';
import * as X2JS from 'x2js';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { TaskState } from './task';

export class ASROperation extends Operation {

  public constructor(name: string, icon?: string, state?: TaskState) {
    super(name, icon, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();
    const url = 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/runPipelineWebLink?' +
      ((inputs.length > 1) ? 'TEXT=' + inputs[ 1 ].url + '&' : '') +
      'SIGNAL=' + inputs[ 0 ].url + '&' +
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
          this._time.end = Date.now();
          this.results.push(FileInfo.fromURL(json.downloadLink));
          this.changeState(TaskState.FINISHED);
        } else {
          this.changeState(TaskState.ERROR);
        }

        // add messages to protocol
        if (json.warnings !== '') {
          this._protocol = json.warnings;
        }
      },
      (error) => {
        this.changeState(TaskState.ERROR);
        console.error(error);
      });
  };

  public clone(): ASROperation {
    return new ASROperation(this.name, this.icon, this.state);
  }
}
