import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {Task} from './index';
import {FileInfo} from '../fileInfo';
import {Operation} from './operation';
import {TaskState} from './task';
import {ToolOperation} from './tool-operation';
import {AppInfo} from '../../app.info';
import {UploadOperation} from './upload-operation';

export class OCTRAOperation extends ToolOperation {
  protected operations: Operation[];
  public resultType = 'BAS Partitur Format';

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState, id?: number) {
    super(name, icon, task, state, id);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._protocol = '';
    this.operations = operations;
    this.changeState(TaskState.READY);
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

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public getToolURL(): string {
    let audio = `audio=${encodeURIComponent((<UploadOperation> this.operations[0]).wavFile.url)}`;
    let transcript = `transcript=`;
    let embedded = `embedded=1`;
    let host = `host=${encodeURIComponent(AppInfo.getLanguageByCode(this.task.language).host)}`;


    if (this.results.length < 1) {
      if (this.previousOperation.results.length > 0) {
        let url = this.previousOperation.lastResult.url;
        transcript += encodeURIComponent(url);
      } else if (this.previousOperation.previousOperation.results.length > 1) {
        let url = this.previousOperation.previousOperation.lastResult.url;
        transcript += encodeURIComponent(url);
        console.log(`transcript url: ${transcript}`);
      } else {
        transcript = '';
      }
    } else {
      let url = this.lastResult.url;
      transcript += encodeURIComponent(url);
    }

    return `https://www.phonetik.uni-muenchen.de/apps/octra/octra/user/load?` +
      `${audio}&` +
      `${transcript}&` +
      `${host}&` +
      `${embedded}`;
  }

  public onMouseOver() {
  }

  public fromAny(operationObj: any, task: Task): OCTRAOperation {
    const result = new OCTRAOperation(operationObj.name, this.icon, task, operationObj.state, operationObj.id);
    for (let k = 0; k < operationObj.results.length; k++) {
      const resultObj = operationObj.results[k];
      const resultClass = FileInfo.fromAny(resultObj);
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result._protocol = operationObj.protocol;
    result.operations = task.operations;
    result.enabled = operationObj.enabled;
    return result;
  }

  public clone(task?: Task): OCTRAOperation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new OCTRAOperation(this.name, this.icon, selected_task, this.state);
  }
}
