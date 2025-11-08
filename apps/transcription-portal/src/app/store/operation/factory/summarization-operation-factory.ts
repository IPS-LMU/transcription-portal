import { StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface SummarizationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
  provider?: string;
}

export class SummarizationOperation extends StoreTaskOperation<SummarizationOperationOptions> {}

export class SummarizationOperationFactory extends OperationFactory<SummarizationOperation, SummarizationOperationOptions> {
  protected readonly _description = 'Summarizes a given full text.';
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

  override applyTaskOptions(options: StoreItemTaskOptions, operation: SummarizationOperation): SummarizationOperation {
    return new SummarizationOperation({
      ...operation,
      options: {
        language: options.asr?.language,
        maxNumberOfWords: options.summarization?.numberOfWords,
        provider: options.summarization?.provider?.provider,
      },
    });
  }
}
