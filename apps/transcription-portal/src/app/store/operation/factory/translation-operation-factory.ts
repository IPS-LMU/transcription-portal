import { StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface TranslationOperationOptions {
  language?: string;
}

export class TranslationOperation extends StoreTaskOperation<TranslationOperationOptions, TranslationOperation> {
  override clone(): TranslationOperation {
    return new TranslationOperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, TranslationOperation>>): TranslationOperation {
    return new TranslationOperation(partial);
  }
}

export class TranslationOperationFactory extends OperationFactory<TranslationOperation, TranslationOperationOptions> {
  protected readonly _description = 'Summarizes a given full text.';
  protected readonly _name = 'Translation';
  protected readonly _resultType = 'Text';
  protected readonly _shortTitle = 'TR';
  protected readonly _title = 'Translation';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): TranslationOperation {
    return new TranslationOperation({
      enabled: true,
      id,
      name: this.name,
      options: {},
      serviceProviderName: 'LibreTranslate',
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: TranslationOperation): TranslationOperation {
    return operation.duplicate({
      ...operation,
      options: {
        language: options.translation?.language === undefined ? operation.options?.language : options.translation?.language,
      },
    });
  }
}
