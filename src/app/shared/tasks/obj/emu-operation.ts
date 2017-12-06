import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';
import { TaskState } from './task';
import { ToolOperation } from './tool-operation';

export class EmuOperation extends ToolOperation {
  private operations: Operation[];

  public constructor(name: string, icon?: string, state?: TaskState) {
    super(name, icon, state);
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    this._time.start = Date.now();
    this.changeState(TaskState.PROCESSING);

    setTimeout(() => {
      this.changeState(TaskState.FINISHED);
      this.time.end = Date.now();
      this.operations = operations;
    }, 1000);
  };

  public getStateIcon = (sanitizer: DomSanitizer): String => {
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
        result = '<span class="glyphicon glyphicon-edit link"></span>';
        break;
      case(TaskState.READY):
        result = '<a href="#"><span class="glyphicon glyphicon-edit"></span></a>';
        break;
      case(TaskState.ERROR):
        result = '<span class="glyphicon glyphicon-remove"></span>';
        break;
    }

    return result;
  };

  public getToolURL(): string {
    return 'https://ips-lmu.github.io/EMU-webApp/?audioGetUrl=' + this.operations[ 0 ].results[ 0 ].url
      + '&labelGetUrl=' + this.operations[ 3 ].results[ 0 ].url + '&labelType=annotJSON';
  }

  public clone(): EmuOperation {
    return new EmuOperation(this.name, this.icon, this.state);
  }
}
