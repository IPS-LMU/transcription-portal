import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export class UploadOperation extends StoreTaskOperation<any>{}

export class UploadOperationFactory extends OperationFactory<UploadOperation> {
  protected readonly _description =
    'Drag and drop your audio and optional text files on the web page to upload them to the server ' +
    'for processing. Prior to upload, the format of the audio files will be checked; stereo files will be split into ' +
    'their left and right channel.';
  protected readonly _name = 'Upload';
  protected readonly _resultType = '.wav';
  protected readonly _shortTitle = 'UL';
  protected readonly _title = 'Upload';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): UploadOperation {
    return new UploadOperation({
      enabled: true,
      id,
      mouseOver: false,
      name: '',
      options: {},
      rounds,
      taskID,
    });
  }
}
