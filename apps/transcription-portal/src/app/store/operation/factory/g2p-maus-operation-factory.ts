import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface G2pMausOperationOptions{
  language?: string;
}
export type G2pMausOperation = StoreTaskOperation<G2pMausOperationOptions>;

export class G2pMausOperationFactory extends OperationFactory<G2pMausOperation> {
  protected readonly _description =
    'The transcript text is time-aligned with the signal, i. e. for every word in the text we get ' +
    'the appropriate fragment of the audio signal. MAUS generates such a word alignment from the transcript and the audio file.';
  protected readonly _name = 'MAUS';
  protected readonly _resultType = 'BAS Partitur Format';
  protected readonly _shortTitle = 'WA';
  protected readonly _title = 'Word alignment';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): G2pMausOperation {
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
