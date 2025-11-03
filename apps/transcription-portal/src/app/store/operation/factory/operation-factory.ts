import { StoreTaskOperationProcessingRound } from '../operation';

export abstract class OperationFactory<T extends object = any> {
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
}
