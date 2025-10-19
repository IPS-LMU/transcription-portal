import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ServiceProvider } from '@octra/ngx-components';
import { FileInfo } from '@octra/web-media';
import { Task, TaskStatus } from '../tasks';
import { IOperation, Operation } from './operation';
import { wait } from '@octra/utilities';

export class ToolOperation extends Operation {
  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    state?: TaskStatus,
    id?: number,
    serviceProvider?: ServiceProvider
  ) {
    super(name, commands, title, shortTitle, task, state, id, serviceProvider);
  }

  public resultType?: string;

  private active = true;

  public start = async (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient, accessCode?: string) => {
    this._time.start = Date.now();
    this.changeState(TaskStatus.PROCESSING);

    await wait(2);
    this.changeState(TaskStatus.FINISHED);
    this.time.duration = 0;
  };

  public override getStateIcon = (sanitizer: DomSanitizer): SafeHtml => {
    let result = '';

    switch (this.state) {
      case TaskStatus.PENDING:
        result = ``;
        break;
      case TaskStatus.UPLOADING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.PROCESSING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskStatus.READY:
        result = '<a href="#"><i class="bi bi-pencil-square" aria-hidden="true"></i></a>';
        break;
      case TaskStatus.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public override clone(task?: Task): ToolOperation {
    const selectedTasks = task === null || task === undefined ? this.task : task;
    return new ToolOperation(
      this.name,
      this._commands,
      this.title,
      this.shortTitle,
      selectedTasks,
      this.state,
      undefined,
      this.serviceProvider
    ) as ToolOperation;
  }

  public fromAny(operationObj: IOperation, commands: string[], task: Task): Operation {
    const result = new ToolOperation(operationObj.name, commands, this.title, this.shortTitle, task, operationObj.state, operationObj.id);
    for (const resultObj of operationObj.results) {
      const resultClass = new FileInfo(resultObj.fullname, resultObj.type, resultObj.size);
      resultClass.url = resultObj.url;
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    this.updateProtocol(operationObj.protocol);
    result.enabled = operationObj.enabled;
    return result;
  }

  public async getToolURL(httpClient: HttpClient): Promise<string> {
    return '';
  }
}
