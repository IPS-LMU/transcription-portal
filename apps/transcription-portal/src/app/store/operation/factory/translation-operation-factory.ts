import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface TranslationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export class TranslationOperation extends StoreTaskOperation<TranslationOperationOptions>{}

export class TranslationOperationFactory extends OperationFactory<TranslationOperation> {
  protected readonly _description = 'Summarizes a given full text.';
  protected readonly _name = 'Translation';
  protected readonly _resultType = 'Text';
  protected readonly _shortTitle = 'TR';
  protected readonly _title = 'Translation';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): TranslationOperation {
    return new TranslationOperation({
      enabled: true,
      id,
      mouseOver: false,
      name: '',
      options: {},
      rounds,
      taskID,
    });
  }
}
