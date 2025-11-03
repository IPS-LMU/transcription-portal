import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface SummarizationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export type SummarizationOperation = StoreTaskOperation<SummarizationOperationOptions>;

export class SummarizationOperationFactory extends OperationFactory<SummarizationOperation> {
  protected readonly description =
    'Summarizes a given full text.';
  protected readonly name = 'Summarization';
  protected readonly resultType = 'Text';
  protected readonly shortTitle = 'SUM';
  protected readonly title = 'Summarization';

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
