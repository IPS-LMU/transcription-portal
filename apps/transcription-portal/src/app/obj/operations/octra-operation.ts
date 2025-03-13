import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { ServiceProvider } from '@octra/ngx-components/lib/components/asr-options/types';
import { stringifyQueryParams } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { AppSettings } from '../../shared/app.settings';
import { ProviderLanguage } from '../oh-config';
import { Task, TaskState } from '../tasks';
import { Operation } from './operation';
import { ToolOperation } from './tool-operation';
import { UploadOperation } from './upload-operation';

export class OCTRAOperation extends ToolOperation {
  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    state?: TaskState,
    id?: number,
  ) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description =
      'A literal transcript contains the verbatim text of a speech recording.' +
      'These transcripts are either generated by Automatic Speech Recognition or they are created manually from scratch.' +
      'The editor Octra allows you to correct or create such transcripts.';
  }

  public override resultType = 'BAS Partitur Format';

  protected operations: Operation[] | undefined;

  public override start = (
    asrService: ServiceProvider,
    languageObject: ProviderLanguage,
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode: string,
  ) => {
    this.updateProtocol('');
    this.operations = operations;
    this.changeState(TaskState.READY);
  };

  public override getStateIcon = (sanitizer: DomSanitizer) => {
    let result = '';

    switch (this.state) {
      case TaskState.PENDING:
        result = ``;
        break;
      case TaskState.UPLOADING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.PROCESSING:
        result = '<i class="bi bi-gear-fill spin link" aria-hidden="true"></i>';
        break;
      case TaskState.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskState.READY:
        result = '<i class="bi bi-pencil-square link" aria-hidden="true"></i>';
        break;
      case TaskState.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public override getStateIcon2 = () => {
    let result = '';

    switch (this.state) {
      case TaskState.PENDING:
        result = ``;
        break;
      case TaskState.UPLOADING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.PROCESSING:
        result = '<i class="bi bi-gear-fill spin link" aria-hidden="true"></i>';
        break;
      case TaskState.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskState.READY:
        result = '<i class="bi bi-pencil-square link" aria-hidden="true"></i>';
        break;
      case TaskState.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public override clone(task?: Task): OCTRAOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new OCTRAOperation(
      this.name,
      this._commands,
      this.title,
      this.shortTitle,
      selectedTask,
      this.state,
    );
  }

  public override fromAny(
    operationObj: any,
    commands: string[],
    task: Task,
  ): OCTRAOperation {
    const result = new OCTRAOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id,
    );
    for (const operationResult of operationObj.results) {
      const resultClass = FileInfo.fromAny(operationResult);
      resultClass.attributes = operationResult.attributes;
      result.results.push(resultClass);
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
    if (
      this.operations &&
      !(
        (this.operations[0] as UploadOperation).wavFile === null ||
        (this.operations[0] as UploadOperation).wavFile === undefined
      ) &&
      this.task
    ) {
      const audio_url = encodeURIComponent(
        (this.operations[0] as any)?.wavFile?.url,
      ) as string;
      const audio_name = (this.operations[0] as UploadOperation)?.wavFile
        ?.fullname;
      let transcript: string | undefined;
      const embedded = `1`;

      const langObj = AppSettings.getLanguageByCode(
        this.task.asrLanguage!,
        this.task.asrProvider!,
      );
      const provider = AppSettings.getServiceInformation(
        this.task.asrProvider!,
      );

      if (langObj && provider) {
        const host = encodeURIComponent(provider.host);

        if (this.results.length < 1 && this.previousOperation) {
          if (
            this.previousOperation.results.length > 0 &&
            this.previousOperation.lastResult
          ) {
            const url = this.previousOperation.lastResult.url;
            transcript = encodeURIComponent(url!);
          } else if (
            this.previousOperation.previousOperation &&
            this.previousOperation.previousOperation.lastResult &&
            this.previousOperation.previousOperation.results.length > 1
          ) {
            const url = this.previousOperation.previousOperation.lastResult.url;
            transcript = encodeURIComponent(url!);
          }
        } else if (this.lastResult) {
          const url = this.lastResult.url;
          transcript = encodeURIComponent(url!);
        }

        return `${this._commands[0]}/${stringifyQueryParams({
          audio_url,
          audio_name,
          transcript,
          host,
          embedded,
        })}`;
      } else {
        console.log(
          `langObj or provider not found in octra operation lang:${this.task.asrLanguage} and ${this.task.asrProvider}`,
        );
      }
    }
    return '';
  }
}
