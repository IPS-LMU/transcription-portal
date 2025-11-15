import { HttpClient } from '@angular/common/http';
import { stringifyQueryParams, SubscriptionManager } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Observable, Subscription, throwError } from 'rxjs';
import { AppSettings } from '../../../shared/app.settings';
import { StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { getLastOperationResultFromLatestRound, getLastOperationRound } from '../operation.functions';
import { OperationFactory } from './operation-factory';

export type EmuOperation = StoreTaskOperation<any, EmuOperation>;
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
    return {
      enabled: true,
      id,
      name: this.name,
      serviceProviderName: 'BAS',
      options: {},
      rounds,
      taskID,
    };
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: EmuOperation): EmuOperation {
    return operation;
  }

  override run(
    storeItemTask: StoreItemTask,
    operation: EmuOperation,
    httpClient: HttpClient,
    subscrManager: SubscriptionManager<Subscription>,
  ): Observable<{ operation: StoreTaskOperation }> {
    return throwError(() => new Error('Not implemented'));
  }

  public async getToolURL(task: StoreItemTask, operation: StoreTaskOperation, httpClient: HttpClient): Promise<string> {
    const serviceProvider = AppSettings.getServiceInformation(operation.serviceProviderName);

    if (task?.operations && serviceProvider && getLastOperationRound(task.operations[0])?.results.find((a) => a.type.includes('audio'))) {
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
      const lastResultMaus = getLastOperationRound(previousOperation);
      const lastResultEMU = getLastOperationRound(operation);

      if (lastResultEMU && lastResultMaus) {
        result = getLastOperationResultFromLatestRound(operation);
      } else {
        result = getLastOperationResultFromLatestRound(previousOperation);
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
