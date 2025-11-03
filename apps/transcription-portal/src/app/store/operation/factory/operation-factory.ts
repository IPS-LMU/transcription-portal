import { StoreTaskOperationProcessingRound } from '../operation';

export abstract class OperationFactory<T> {
  protected abstract readonly name: string;
  protected abstract readonly title: string;
  protected abstract readonly description: string;
  protected abstract readonly shortTitle: string;
  protected abstract readonly resultType: string;

  abstract create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): T;
}
