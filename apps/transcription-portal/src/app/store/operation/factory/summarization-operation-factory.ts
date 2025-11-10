import { StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface SummarizationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export class SummarizationOperation extends StoreTaskOperation<SummarizationOperationOptions, SummarizationOperation> {
  override clone(): SummarizationOperation {
    return new SummarizationOperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, SummarizationOperation>>): SummarizationOperation {
    return new SummarizationOperation(partial);
  }
}

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
      name: this.name,
      options: {},
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: SummarizationOperation): SummarizationOperation {
    return new SummarizationOperation({
      ...operation,
      serviceProviderName: options.summarization?.provider === undefined ? operation.serviceProviderName : options.summarization?.provider,
      options: {
        language: options.asr?.language === undefined ? operation.options?.language : options.asr?.language,
        maxNumberOfWords:
          options.summarization?.numberOfWords === undefined ? operation.options?.maxNumberOfWords : options.summarization?.numberOfWords,
      },
    });
  }
}
