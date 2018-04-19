import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../fileInfo';
import {Task} from './index';
import {Operation} from './operation';
import {TaskState} from './task';
import {ToolOperation} from './tool-operation';

export class EmuOperation extends ToolOperation {
  protected operations: Operation[];

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, icon, task, state, id);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._time.start = Date.now();
    this.changeState(TaskState.PROCESSING);
    this.time.duration = 0;
    this.operations = operations;
    this.changeState(TaskState.FINISHED);
  };

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
  };

  public getToolURL(): string {
    const audio = encodeURIComponent(this.operations[0].results[0].url);
    const transcript = encodeURIComponent(this.previousOperation.lastResult.url);
    return `https://ips-lmu.github.io/EMU-webApp/?audioGetUrl=${audio}&labelGetUrl=${transcript}&labelType=annotJSON`;
  }

  public fromAny(operationObj: any, task: Task): Operation {
    const result = new EmuOperation(operationObj.name, this.icon, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const result = operationObj.results[k];
      result.results.push(FileInfo.fromAny(result));
      result.url = result;
    }
    result._time = operationObj.time;
    result._protocol = operationObj.protocol;
    result.operations = task.operations;
    result.enabled = operationObj.enabled;
    return result;
  }

  public clone(task?: Task): EmuOperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new EmuOperation(this.name, this.icon, selected_task, this.state);
  }
}
