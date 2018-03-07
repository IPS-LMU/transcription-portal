import {HttpClient} from '@angular/common/http';
import {SafeHtml} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {Task, TaskState} from './task';

export class ToolOperation extends Operation {

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, icon, task, state, id);
  }

  private active = true;

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._time.start = Date.now();
    this.changeState(TaskState.PROCESSING);

    setTimeout(() => {
      this.changeState(TaskState.FINISHED);
      this.time.duration = 0;
    }, 2000);
  };

  public getStateIcon = (sanitizer): SafeHtml => {
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
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
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
    return '';
  }

  public fromAny(operationObj: any, task: Task): Operation {
    const result = new ToolOperation(operationObj.name, this.icon, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const result = operationObj.results[k];
      result.results.push(new FileInfo(result.fullname, result.type, result.size));
      result.url = result;
    }
    result._time = operationObj.time;
    result._protocol = operationObj._protocol;
    return result;
  }

  public clone(task?: Task): ToolOperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new ToolOperation(this.name, this.icon, selected_task, this.state);
  }
}
