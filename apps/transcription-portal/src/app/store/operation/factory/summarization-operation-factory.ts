import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface SummarizationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export class SummarizationOperation extends StoreTaskOperation<SummarizationOperationOptions>{}

export class SummarizationOperationFactory extends OperationFactory<SummarizationOperation> {
  protected readonly _description =
    'Summarizes a given full text.';
  protected readonly _name = 'Summarization';
  protected readonly _resultType = 'Text';
  protected readonly _shortTitle = 'SUM';
  protected readonly _title = 'Summarization';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): SummarizationOperation {
    return new SummarizationOperation({
      enabled: true,
      id,
      name: '',
      options: {},
      rounds,
      taskID,
    });
  }
}
