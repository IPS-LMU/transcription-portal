import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {FileInfo} from '../fileInfo';
import {Task} from '../tasks/index';
import {Operation} from './operation';
import {TaskState} from '../tasks/task';
import {ToolOperation} from './tool-operation';
import {UploadOperation} from './upload-operation';
import {OHLanguageObject} from '../oh-config';

export class EmuOperation extends ToolOperation {
  protected operations: Operation[];

  public constructor(name: string, commands: string[], title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description = 'The phonetic detail editor presents an interactive audio-visual display of the audio signal and ' +
      'the associated words or phonemes. This is useful for interpreting a transcript, e. g. to determine the focus of' +
      ' a sentence or phrase.';
  }

  public start = (languageObject: OHLanguageObject, inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._time.start = Date.now();
    this.changeState(TaskState.PROCESSING);
    this.time.duration = 0;
    this.operations = operations;
    this.changeState(TaskState.FINISHED);
  }

  public getStateIcon = (sanitizer: DomSanitizer) => {
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
        if (this.previousOperation.results.length > 0 && this.previousOperation.lastResult.available) {
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
  }

  public getStateIcon2 = () => {
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
        if (this.previousOperation.results.length > 0 && this.previousOperation.lastResult.available) {
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

    return result;
  }

  public getToolURL(): string {
    if (!(this.previousOperation.lastResult === null || this.previousOperation.lastResult === undefined)) {
      const uploadOP = <UploadOperation> this.operations[0];
      const audio = encodeURIComponent(uploadOP.wavFile.url);
      const transcript = encodeURIComponent(this.previousOperation.lastResult.url);
      const labelType = (this.previousOperation.lastResult.extension === '.json') ? 'annotJSON' : 'TEXTGRID';
      return `${this._commands[0]}?audioGetUrl=${audio}&labelGetUrl=${transcript}&labelType=${labelType}`;
    }
    return ``;
  }

  public fromAny(operationObj: any, commands: string[], task: Task): Operation {
    const result = new EmuOperation(operationObj.name, commands, this.title, this.shortTitle, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const result2 = operationObj.results[k];
      result.results.push(FileInfo.fromAny(result2));
    }
    result._time = operationObj.time;
    result._protocol = operationObj.protocol;
    result.operations = task.operations;
    result.enabled = operationObj.enabled;
    return result;
  }

  public clone(task?: Task): EmuOperation {
    const selected_task = ((task === null || task === undefined)) ? this.task : task;
    return new EmuOperation(this.name, this._commands, this.title, this.shortTitle, selected_task, this.state);
  }
}
