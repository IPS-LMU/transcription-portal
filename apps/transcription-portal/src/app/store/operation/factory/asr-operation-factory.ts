import { StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface ASROperationOptions {
  language?: string;
  diarization?: {
    enabled?: boolean;
    speakers?: number;
  };
}

export class ASROperation extends StoreTaskOperation<ASROperationOptions, ASROperation> {
  override clone(): ASROperation {
    return new ASROperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, ASROperation>>): ASROperation {
    return new ASROperation(partial);
  }
}

export class ASROperationFactory extends OperationFactory<ASROperation, ASROperationOptions> {
  protected readonly _description =
    'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
    'The result of this process is a text file with a literal transcription of the audio file. \n' +
    'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  protected readonly _name = 'ASR';
  protected readonly _resultType = 'BAS Partitur Format';
  protected readonly _shortTitle = 'ASR';
  protected readonly _title = 'Speech Recognition';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): ASROperation {
    return new ASROperation({
      enabled: true,
      id,
      name: this.name,
      options: {},
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: ASROperation) {
    return new ASROperation({
      ...operation,
      serviceProviderName: options.asr?.provider === undefined ? operation.serviceProviderName : options.asr?.provider,
      options: {
        language: options.asr?.language === undefined ? operation.options?.language : options.asr?.language,
        diarization: options.asr?.diarization === undefined ? operation.options?.diarization : options.asr?.diarization,
      },
    });
  }
}
