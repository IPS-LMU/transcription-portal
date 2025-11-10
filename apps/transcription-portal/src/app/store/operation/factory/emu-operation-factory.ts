import { StoreItemTaskOptions } from '../../store-item';
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
      serviceProviderName: "BAS",
      options: {},
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: EmuOperation): EmuOperation {
    return operation;
  }
}
