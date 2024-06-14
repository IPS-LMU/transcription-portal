import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {Task, TaskState} from '../tasks';
import {Operation} from './operation';
import {ToolOperation} from './tool-operation';
import {UploadOperation} from './upload-operation';
import {OHLanguageObject} from '../oh-config';
import {AppSettings} from '../../shared/app.settings';
import {FileInfo} from '@octra/web-media';

export class EmuOperation extends ToolOperation {
  protected operations?: Operation[];

  public constructor(name: string, commands: string[], title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description = 'The phonetic detail editor presents an interactive audio-visual display of the audio signal and ' +
      'the associated words or phonemes. This is useful for interpreting a transcript, e. g. to determine the focus of' +
      ' a sentence or phrase.';
  }

  public override resultType = 'AnnotJSON';

  public override start = (languageObject: OHLanguageObject, inputs: FileInfo[], operations: Operation[],
                  httpclient: HttpClient, accessCode: string) => {
    this.updateProtocol('');
    this.operations = operations;
    this.changeState(TaskState.READY);
  };

  public override getStateIcon = (sanitizer: DomSanitizer) => {
    let result = '';

    switch (this.state) {
      case(TaskState.PENDING):
        result = ``;
        break;
      case(TaskState.UPLOADING):
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.PROCESSING):
        result = '<i class="fa fa-cog fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.FINISHED):
        if (this.previousOperation && this.previousOperation.results.length > 0 && this.previousOperation.lastResult?.available) {
          result = '<i class="fa fa-pencil-square-o link" aria-hidden="true"></i>';
        } else {
          result = '<i class="fa fa-chain-broken" style="color:red;opacity:0.5;" aria-hidden="true"></i>';
        }
        break;
      case(TaskState.READY):
        result = '<a href="#"><i class="fa fa-pencil-square-o" aria-hidden="true"></i></a>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public override getStateIcon2 = () => {
    let result = '';

    switch (this.state) {
      case(TaskState.PENDING):
        result = ``;
        break;
      case(TaskState.UPLOADING):
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.PROCESSING):
        result = '<i class="fa fa-cog fa-spin link" aria-hidden="true"></i>';
        break;
      case(TaskState.FINISHED):
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
        break;
      case(TaskState.READY):
        result = '<i class="fa fa-pencil-square-o link" aria-hidden="true"></i>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public override clone(task?: Task): EmuOperation {
    const selectedTask = ((task === null || task === undefined)) ? this.task : task;
    return new EmuOperation(this.name, this._commands, this.title, this.shortTitle, selectedTask, this.state);
  }

  public override fromAny(operationObj: any, commands: string[], task: Task): Operation {
    const result = new EmuOperation(operationObj.name, commands, this.title,
      this.shortTitle, task, operationObj.state, operationObj.id);
    for (const resultElement of operationObj.results) {
      result.results.push(FileInfo.fromAny(resultElement));
    }

    if (result.state === TaskState.PROCESSING) {
      if (result.results.length > 0) {
        result.changeState(TaskState.FINISHED);
      } else {
        result.changeState(TaskState.READY);
      }
    }

    result._time = operationObj.time;
    result.updateProtocol(operationObj.protocol);
    result.operations = task.operations;
    result.enabled = operationObj.enabled;
    return result;
  }

  public override getToolURL(): string {
    if (this.operations && !((this.operations[0] as UploadOperation).wavFile === null || (this.operations[0] as UploadOperation).wavFile === undefined)) {
      // @ts-ignore TODO CHECK
      const audio = `audioGetUrl=${encodeURIComponent((this.operations[0] as UploadOperation).wavFile.url)}`;
      let transcript = `labelGetUrl=`;
      const langObj = AppSettings.getLanguageByCode(this.task?.language, this.task?.asr);
      let result = null;
      const lastResultMaus = this.previousOperation?.lastResult;
      const lastResultEMU = this.lastResult;

      if (lastResultEMU && lastResultMaus && lastResultEMU.createdAt >= lastResultMaus.createdAt) {
        result = lastResultEMU;
      } else {
        result = lastResultMaus;
      }

      const labelType = (result?.extension === '_annot.json') ? 'annotJSON' : 'TEXTGRID';

      if (!(langObj === null || langObj === undefined) && result?.url) {
        transcript += encodeURIComponent(result.url);

        return `${this._commands[0]}?` +
          `${audio}&` +
          `${transcript}&` +
          `&labelType=${labelType}` +
          `&saveToWindowParent=true`;
      } else if (!result?.url) {
        console.error(`result url is null or undefined`);
      } else {
        console.log(`langObj not found in octra operation lang:${this.task?.language} and ${this.task?.asr}`);
      }
    }
    return '';
  }
}
