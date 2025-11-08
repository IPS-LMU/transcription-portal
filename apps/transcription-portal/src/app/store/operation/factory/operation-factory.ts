import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { StoreItemTaskOptions } from '../../store-item';

export abstract class OperationFactory<T extends StoreTaskOperation<R> = any, R extends object = any> {
  protected abstract readonly _name: string;
  protected abstract readonly _title: string;
  protected abstract readonly _description: string;
  protected abstract readonly _shortTitle: string;
  protected abstract readonly _resultType: string;

  get name(): string {
    return this._name;
  }

  get title(): string {
    return this._title;
  }

  get description(): string {
    return this._description;
  }

  get shortTitle(): string {
    return this._shortTitle;
  }

  get resultType(): string {
    return this._resultType;
  }

  abstract create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): T;

  abstract applyTaskOptions(options: StoreItemTaskOptions, operation: T): T;
}
