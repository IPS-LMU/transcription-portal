import { HttpClient } from '@angular/common/http';
import { DomSanitizer } from '@angular/platform-browser';
import { ServiceProvider } from '@octra/ngx-components';
import { stringifyQueryParams } from '@octra/utilities';
import { AppSettings } from '../../shared/app.settings';
import { Task, TaskStatus } from '../tasks';
import { TPortalAudioInfo, TPortalFileInfo } from '../TPortalFileInfoAttributes';
import { IOperation, Operation, OperationOptions, OperationProcessingRound } from './operation';
import { ToolOperation } from './tool-operation';
import { UploadOperation } from './upload-operation';

export type IEmuWebAppOperation = IOperation;

export class EmuOperation extends ToolOperation {
  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    id?: number,
    serviceProvider?: ServiceProvider,
  ) {
    super(name, commands, title, shortTitle, task, id, serviceProvider);
    this._description =
      'The phonetic detail editor presents an interactive audio-visual display of the audio signal and ' +
      'the associated words or phonemes. This is useful for interpreting a transcript, e. g. to determine the focus of' +
      ' a sentence or phrase.';
  }

  public override resultType = 'AnnotJSON';

  public override start = async (
    inputs: (TPortalFileInfo | TPortalAudioInfo)[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode?: string,
  ) => {
    throw new Error('Octra will not be started automatically.');
  };

  public override getStateIcon2 = () => {
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
        result = '<i class="bi bi-gear-fill spin link" aria-hidden="true"></i>';
        break;
      case TaskStatus.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskStatus.READY:
        result = '<i class="bi bi-pencil-square link" aria-hidden="true"></i>';
        break;
      case TaskStatus.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public override clone(task?: Task, id?: number): EmuOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new EmuOperation(this.name, this._commands, this.title, this.shortTitle, selectedTask, id, this.serviceProvider);
  }

  public override fromAny(operationObj: IEmuWebAppOperation, commands: string[], task: Task): Operation {
    const result = new EmuOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider),
    );

    for (const resultObj of operationObj.rounds) {
      result.rounds.push(OperationProcessingRound.fromAny(resultObj));
    }

    if (result.state === TaskStatus.PROCESSING) {
      if (result.rounds.length > 0) {
        result.changeState(TaskStatus.FINISHED);
      } else {
        result.changeState(TaskStatus.READY);
      }
    }

    result.enabled = operationObj.enabled;
    result.parseProtocol();

    return result;
  }

  public override async getToolURL(): Promise<string> {
    if (
      this.task?.operations &&
      this.serviceProvider &&
      !(
        (this.task.operations[0] as unknown as UploadOperation).wavFile === null ||
        (this.task.operations[0] as unknown as UploadOperation).wavFile === undefined
      )
    ) {
      const urlParams: {
        audioGetUrl: string;
        labelGetUrl?: string;
        labelType?: string;
        saveToWindowParent: boolean;
      } = {
        audioGetUrl: (this.task.operations[0] as any).wavFile.url,
        saveToWindowParent: true,
      };
      let result: TPortalFileInfo | undefined = undefined;
      const lastResultMaus = this.previousOperation?.lastRound;
      const lastResultEMU = this.lastRound;

      if (
        lastResultEMU &&
        lastResultMaus &&
        lastResultEMU.lastResult?.createdAt &&
        lastResultMaus.lastResult?.createdAt &&
        lastResultEMU.lastResult?.createdAt >= lastResultMaus.lastResult.createdAt
      ) {
        result = lastResultEMU.lastResult;
      } else {
        result = lastResultMaus?.lastResult;
      }

      const labelType = result?.extension === '_annot.json' ? 'annotJSON' : 'TEXTGRID';

      if (result?.url) {
        urlParams.labelGetUrl = result.url;
        urlParams.labelType = labelType;

        return `${this._commands[0]}${stringifyQueryParams(urlParams)}`;
      } else if (!result?.url) {
        console.error(`result url is null or undefined`);
      }
    }
    return '';
  }

  override overwriteOptions(options: OperationOptions) {
    this._serviceProvider = AppSettings.getServiceInformation('BAS');
  }

  override async toAny(): Promise<IEmuWebAppOperation> {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      rounds: await this.serializeProcessingRounds(),
      serviceProvider: this.serviceProvider?.provider,
    };
  }
}
