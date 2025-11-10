import { StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export class UploadOperation extends StoreTaskOperation<any, UploadOperation> {
  override clone(): UploadOperation {
    return new UploadOperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, UploadOperation>>): UploadOperation {
    return new UploadOperation(partial);
  }
}

export class UploadOperationFactory extends OperationFactory<UploadOperation> {
  protected readonly _description =
    'Drag and drop your audio and optional text files on the web page to upload them to the server ' +
    'for processing. Prior to upload, the format of the audio files will be checked; stereo files will be split into ' +
    'their left and right channel.';
  protected readonly _name = 'Upload';
  protected readonly _resultType = '.wav';
  protected readonly _shortTitle = 'UL';
  protected readonly _title = 'Upload';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[], options: any = {}): UploadOperation {
    return new UploadOperation({
      enabled: true,
      id,
      name: this.name,
      serviceProviderName: 'BAS',
      options,
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: UploadOperation) {
    // no options to apply
    return operation;
  }
}
