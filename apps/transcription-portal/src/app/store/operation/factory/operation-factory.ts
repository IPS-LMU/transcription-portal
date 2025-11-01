import { HttpClient } from '@angular/common/http';
import { Observable, Subject, Subscription } from 'rxjs';
import { StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { SubscriptionManager } from '@octra/utilities';
import { IDBOperation } from '../../../indexedDB';

export abstract class OperationFactory<T extends StoreTaskOperation<R> = StoreTaskOperation<any>, R extends object = any> {
  protected abstract readonly _name: string;
  protected abstract readonly _title: string;
  protected abstract readonly _description: string;
  protected abstract readonly _shortTitle: string;
  protected abstract readonly _resultType: string;
  protected readonly commands: string[];

  constructor(commands: string[]) {
    this.commands = commands;
  }

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

  abstract run(
    storeItemTask: StoreItemTask,
    operation: T,
    httpClient: HttpClient,
    subscrManager: SubscriptionManager<Subscription>,
  ): Observable<{
    operation: StoreTaskOperation;
  }>;

  sendOperationWithUpdatedRound(
    subj: Subject<{
      operation: StoreTaskOperation;
    }>,
    operation: StoreTaskOperation,
    currentRound: StoreTaskOperationProcessingRound,
  ) {
    subj.next({
      operation: {
        ...operation,
        rounds: [...(operation.rounds.length > 0 ? operation.rounds.slice(0, operation.rounds.length - 1) : []), currentRound],
      },
    });
  }

  abstract convertOperationToIDBOperation(operation: T): Promise<IDBOperation>;
}
