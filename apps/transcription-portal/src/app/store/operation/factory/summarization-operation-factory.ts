import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface SummarizationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export type SummarizationOperation = StoreTaskOperation<SummarizationOperationOptions>;

export class SummarizationOperationFactory extends OperationFactory<SummarizationOperation> {
  protected readonly _description =
    'Summarizes a given full text.';
  protected readonly _name = 'Summarization';
  protected readonly _resultType = 'Text';
  protected readonly _shortTitle = 'SUM';
  protected readonly _title = 'Summarization';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): SummarizationOperation {
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
