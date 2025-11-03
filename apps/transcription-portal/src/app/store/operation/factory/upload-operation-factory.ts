import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export type UploadOperation = StoreTaskOperation<any>;

export class UploadOperationFactory extends OperationFactory<UploadOperation> {
  protected readonly description =
    'Drag and drop your audio and optional text files on the web page to upload them to the server ' +
    'for processing. Prior to upload, the format of the audio files will be checked; stereo files will be split into ' +
    'their left and right channel.';
  protected readonly name = 'Upload';
  protected readonly resultType = '.wav';
  protected readonly shortTitle = 'UL';
  protected readonly title = 'Upload';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): UploadOperation {
    return {
      enabled: true,
      id,
      mouseOver: false,
      name: '',
      options: {},
      rounds,
      taskID,
    };
  }
}
