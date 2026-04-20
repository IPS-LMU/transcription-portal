import { HttpClient } from '@angular/common/http';
import { SubscriptionManager } from '@octra/utilities';
import { Observable, Subject, Subscription } from 'rxjs';
import { IDBOperation } from '../../../indexedDB';
import { OctraWindowMessageEventData, StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationName } from './factory.types';

export abstract class OperationFactory<T extends StoreTaskOperation<R> = StoreTaskOperation<any>, R extends object = any> {
  protected abstract readonly _name: OperationName;
  protected abstract readonly _title: string;
  protected abstract readonly _description: string;
  protected abstract readonly _shortTitle: string;
  protected abstract readonly _resultType: string;
  protected readonly commands: string[];

  constructor(commands: string[]) {
    this.commands = commands;
  }

  get name(): OperationName {
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

  /**
   * runs a given operation using this method for a given factory.
   * @param storeItemTask The task of the given operation
   * @param operation The operation that should be run
   * @param httpClient The HttpClient
   * @param subscrManager The manager that administrates all subscriptions
   * @param item$ The item observable makes it possible to react on item changes.
   */
  abstract run(
    storeItemTask: StoreItemTask,
    operation: T,
    httpClient: HttpClient,
    subscrManager: SubscriptionManager<Subscription>,
    item$: Observable<StoreItemTask | undefined>,
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

export abstract class ToolOperationFactory<T extends StoreTaskOperation<R> = StoreTaskOperation<any>, R extends object = any> extends OperationFactory<
  T,
  R
> {
  public abstract getToolURL(audioFile: StoreAudioFile, transcriptFile: StoreFile | undefined, firstRevision: boolean, httpClient: HttpClient): Promise<string>;

  public abstract parseMessageEvent(
    $event: MessageEvent,
    iframe: HTMLIFrameElement,
    audioFile: StoreAudioFile,
    transcriptFile: StoreFile | undefined,
  ): Promise<OctraWindowMessageEventData | undefined>;
}
