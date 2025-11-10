import { StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface G2pMausOperationOptions {
  language?: string;
}

export class G2pMausOperation extends StoreTaskOperation<G2pMausOperationOptions, G2pMausOperation> {
  override clone(): G2pMausOperation {
    return new G2pMausOperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, G2pMausOperation>>): G2pMausOperation {
    return new G2pMausOperation(partial);
  }
}

export class G2pMausOperationFactory extends OperationFactory<G2pMausOperation, G2pMausOperationOptions> {
  protected readonly _description =
    'The transcript text is time-aligned with the signal, i. e. for every word in the text we get ' +
    'the appropriate fragment of the audio signal. MAUS generates such a word alignment from the transcript and the audio file.';
  protected readonly _name = 'MAUS';
  protected readonly _resultType = 'BAS Partitur Format';
  protected readonly _shortTitle = 'WA';
  protected readonly _title = 'Word alignment';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): G2pMausOperation {
    return new G2pMausOperation({
      enabled: true,
      id,
      name: this.name,
      serviceProviderName: "BAS",
      options: {},
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: G2pMausOperation) {
    return new G2pMausOperation({
      ...operation,
      options: {
        language: options.maus?.language === undefined ? operation.options?.language : options.maus?.language,
      },
    });
  }
}
