import {HttpClient} from '@angular/common/http';
import {SafeHtml} from '@angular/platform-browser';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {Task, TaskState} from '../tasks';
import {OHLanguageObject} from '../oh-config';

export class ToolOperation extends Operation {
  public resultType;

  public constructor(name: string, commands: string[], title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, commands, title, shortTitle, task, state, id);
  }

  private active = true;

  public start = (languageObject: OHLanguageObject, inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._time.start = Date.now();
    this.changeState(TaskState.PROCESSING);

    setTimeout(() => {
      this.changeState(TaskState.FINISHED);
      this.time.duration = 0;
    }, 2000);
  }

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
  }

  public getToolURL(): string {
    return '';
  }

  public fromAny(operationObj: any, commands: string[], task: Task): Operation {
    const result = new ToolOperation(operationObj.name, commands, this.title, this.shortTitle, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const resultObj = operationObj.results[k];
      const resultClass = new FileInfo(resultObj.fullname, resultObj.type, resultObj.size);
      resultClass.url = resultObj.url;
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    this.updateProtocol(operationObj.protocol);
    result.enabled = operationObj.enabled;
    return result;
  }

  public clone(task?: Task): ToolOperation {
    const selected_task = ((task === null || task === undefined)) ? this.task : task;
    return new ToolOperation(this.name, this._commands, this.title, this.shortTitle, selected_task, this.state);
  }
}
