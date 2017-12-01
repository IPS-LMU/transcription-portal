import { HttpClient } from '@angular/common/http';
import { SafeHtml } from '@angular/platform-browser';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { TaskState } from './task';

export class ToolOperation extends Operation {

  public constructor(name: string, icon?: string, state?: TaskState) {
    super(name, icon, state);
  }

  private active = true;

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._time.start = Date.now();
    this.changeState(TaskState.PROCESSING);

    setTimeout(() => {
      this.changeState(TaskState.FINISHED);
      this.time.end = Date.now();
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
        result = '<span class="glyphicon glyphicon-ok"></span>';
        break;
      case(TaskState.READY):
        result = '<a href="#"><span class="glyphicon glyphicon-edit"></span></a>';
        break;
      case(TaskState.ERROR):
        result = '<span class="glyphicon glyphicon-remove"></span>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public clone(): ToolOperation {
    return new ToolOperation(this.name, this.icon, this.state);
  }
}
