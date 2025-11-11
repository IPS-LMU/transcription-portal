import { HttpClient } from '@angular/common/http';
import { stringifyQueryParams } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Observable, throwError } from 'rxjs';
import { UploadOperation } from '../../../obj/operations/upload-operation';
import { AppSettings } from '../../../shared/app.settings';
import { StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export class EmuOperation extends StoreTaskOperation<any, EmuOperation> {
  override clone(): EmuOperation {
    return new EmuOperation(this);
  }
  override duplicate(partial?: Partial<StoreTaskOperation<any, EmuOperation>>): EmuOperation {
    return new EmuOperation(partial);
  }
}
export class EmuOperationFactory extends OperationFactory<EmuOperation> {
  protected readonly _description =
    'The phonetic detail editor presents an interactive audio-visual display of the audio signal and ' +
    'the associated words or phonemes. This is useful for interpreting a transcript, e. g. to determine the focus of' +
    ' a sentence or phrase.';
  protected readonly _name = 'Emu WebApp';
  protected readonly _resultType = 'AnnotJSON';
  protected readonly _shortTitle = 'PD';
  protected readonly _title = 'Phonetic detail';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): EmuOperation {
    return new EmuOperation({
      enabled: true,
      id,
      name: this.name,
      serviceProviderName: 'BAS',
      options: {},
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: EmuOperation): EmuOperation {
    return operation;
  }

  override run(storeItemTask: StoreItemTask, operation: EmuOperation, httpClient: HttpClient): Observable<{ operation: StoreTaskOperation }> {
    return throwError(() => new Error('Not implemented'));
  }

  public async getToolURL(task: StoreItemTask, operation: StoreTaskOperation, httpClient: HttpClient): Promise<string> {
    const serviceProvider = AppSettings.getServiceInformation(operation.serviceProviderName);

    if (
      task?.operations &&
      serviceProvider &&
      !(
        (task.operations[0] as unknown as UploadOperation).wavFile === null ||
        (task.operations[0] as unknown as UploadOperation).wavFile === undefined
      )
    ) {
      const urlParams: {
        audioGetUrl: string;
        labelGetUrl?: string;
        labelType?: string;
        saveToWindowParent: boolean;
      } = {
        audioGetUrl: (task.operations[0] as any).wavFile.url,
        saveToWindowParent: true,
      };
      let result: StoreFile | undefined = undefined;
      const opIndex = task.operations.findIndex((a) => a.name === operation.name);
      const previousOperation = task.operations[opIndex - 1];
      const lastResultMaus = previousOperation?.lastRound;
      const lastResultEMU = operation.lastRound;

      if (lastResultEMU && lastResultMaus) {
        result = lastResultEMU.lastResult;
      } else {
        result = lastResultMaus?.lastResult;
      }

      const { extension } = FileInfo.extractFileName(result!.name);
      const labelType = extension === '_annot.json' ? 'annotJSON' : 'TEXTGRID';

      if (result?.url) {
        urlParams.labelGetUrl = result.url;
        urlParams.labelType = labelType;

        return `${this.commands[0]}${stringifyQueryParams(urlParams)}`;
      } else if (!result?.url) {
        console.error(`result url is null or undefined`);
      }
    }
    return '';
  }
}
