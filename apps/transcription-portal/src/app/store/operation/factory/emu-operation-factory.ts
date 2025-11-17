import { HttpClient } from '@angular/common/http';
import { stringifyQueryParams, SubscriptionManager } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Observable, Subscription, throwError } from 'rxjs';
import { StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
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

  public async getToolURL(audioFile: StoreAudioFile, transcriptFile: StoreFile | undefined, httpClient: HttpClient): Promise<string> {
    const urlParams: {
      audioGetUrl: string;
      labelGetUrl?: string;
      labelType?: string;
      saveToWindowParent: boolean;
    } = {
      audioGetUrl: audioFile.url!,
      saveToWindowParent: true,
    };

    if (transcriptFile?.url) {
      const { extension } = FileInfo.extractFileName(transcriptFile!.name);
      const labelType = extension === '_annot.json' ? 'annotJSON' : 'TEXTGRID';
      urlParams.labelGetUrl = transcriptFile.url;
      urlParams.labelType = labelType;

      return `${this.commands[0]}${stringifyQueryParams(urlParams)}`;
    } else {
      throw new Error(`result url is null or undefined`);
    }
  }
}
