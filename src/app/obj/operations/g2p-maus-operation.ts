import {HttpClient} from '@angular/common/http';
import * as X2JS from 'x2js';
import {FileInfo} from '../fileInfo';
import {Task} from '../tasks/index';
import {Operation} from './operation';
import {TaskState} from '../tasks/task';
import {AppInfo} from '../../app.info';

export class G2pMausOperation extends Operation {
  // TODO change for the next version
  public resultType = 'TextGrid/json';

  public constructor(name: string, title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, title, shortTitle, task, state, id);
    this._description = 'The transcript text is time-aligned with the signal, i. e. for every word in the text we get ' +
      'the appropriate fragment of the audio signal. MAUS generates such a word alignment from the transcript and the audio file.';
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._protocol = '';
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();

    let url = '';
    const language = ((AppInfo.getLanguageByCode(this.task.language).mausLanguage === null
      || AppInfo.getLanguageByCode(this.task.language).mausLanguage === undefined))
      ? this.task.language :
      AppInfo.getLanguageByCode(this.task.language).mausLanguage;
    if (this.previousOperation.enabled) {
      // use G2P -> MAUS Pipe
      url = AppInfo.getLanguageByCode(this.task.language).host + 'runPipelineWebLink?' +
        'TEXT=' + this.previousOperation.lastResult.url +
        '&SIGNAL=' + operations[0].results[0].url + '&' +
        'PIPE=G2P_MAUS&LANGUAGE=' + language + '&' +
        'MAUSVARIANT=runPipeline&OUTFORMAT=TextGrid';
    } else {
      url = AppInfo.getLanguageByCode(this.task.language).host + 'runPipelineWebLink?' +
        'TEXT=' + operations[1].lastResult.url +
        '&SIGNAL=' + operations[0].results[0].url +
        '&PIPE=G2P_MAUS&LANGUAGE=' + language + '&' +
        'MAUSVARIANT=runPipeline&OUTFORMAT=TextGrid';
    }

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
          const file = FileInfo.fromURL(json.downloadLink, null, 'text/plain');
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
  };

  public fromAny(operationObj: any, task: Task): G2pMausOperation {
    const result = new G2pMausOperation(operationObj.name, this.title, this.shortTitle, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const resultObj = operationObj.results[k];
      const resultClass = FileInfo.fromAny(resultObj);
      resultClass.url = resultObj.url;
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result._protocol = operationObj.protocol;
    result.enabled = operationObj.enabled;
    return result;
  }

  public clone(task?: Task): G2pMausOperation {
    const selected_task = ((task === null || task === undefined)) ? this.task : task;
    return new G2pMausOperation(this.name, this.title, this.shortTitle, selected_task, this.state);
  }
}
