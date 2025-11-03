import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface ASROperationOptions {
  language?: string;
  diarization?: {
    enabled?: boolean;
    speakers?: number;
  };
}

export type ASROperation = StoreTaskOperation<ASROperationOptions>;

export class ASROperationFactory extends OperationFactory<ASROperation> {
  protected readonly description =
    'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
    'The result of this process is a text file with a literal transcription of the audio file. \n' +
    'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  protected readonly name = 'ASR';
  protected readonly resultType = 'BAS Partitur Format';
  protected readonly shortTitle = 'ASR';
  protected readonly title = 'Speech Recognition';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): ASROperation {
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
