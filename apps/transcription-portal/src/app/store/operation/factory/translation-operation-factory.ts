import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface TranslationOperationOptions {
  language?: string;
  maxNumberOfWords?: number;
}

export type TranslationOperation = StoreTaskOperation<TranslationOperationOptions>;

export class TranslationOperationFactory extends OperationFactory<TranslationOperation> {
  protected readonly description = 'Summarizes a given full text.';
  protected readonly name = 'Translation';
  protected readonly resultType = 'Text';
  protected readonly shortTitle = 'TR';
  protected readonly title = 'Translation';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): TranslationOperation {
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
