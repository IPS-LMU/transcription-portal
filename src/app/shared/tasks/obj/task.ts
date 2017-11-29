import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs/Observable';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { isNullOrUndefined } from 'util';
import { SubscriptionManager } from '../../subscription-manager';
import { FileInfo } from './fileInfo';
import { Operation } from './operation';

export enum TaskState {
  'PENDING',
  'PROCESSING',
  'UPLOADING',
  'READY',
  'FINISHED',
  'ERROR'
}

export class Task {
  static counter = 0;
  private statesubj: ReplaySubject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = new ReplaySubject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }>();
  public statechange: Observable<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = this.statesubj.asObservable();

  get operations(): Operation[] {
    return this._operations;
  }

  get files(): FileInfo[] {
    return this._files;
  }

  private _files: FileInfo[];
  // operations that have to be done
  private _operations: Operation[] = [];
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor(files: FileInfo[], operations: Operation[]) {
    this._id = ++Task.counter;
    this._files = files;
    this.sortFilesArray();

    // clone operations param
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[ i ].clone();
      this.subscrmanager.add(operation.statechange.subscribe(
        (event) => {
          this.statesubj.next({
            opID    : operation.id,
            oldState: event.oldState,
            newState: event.newState
          });
        }
      ));

      this.operations.push(operation);
    }

    this._state = TaskState.PENDING;
  }

  private _id: number;

  get id(): number {
    return this._id;
  }

  private _state: TaskState;

  get state(): TaskState {
    return this._state;
  }

  private sortFilesArray() {
    if (!isNullOrUndefined(this._files)) {
      this._files = this._files.sort((a, b) => {
        if (a.extension === 'wav') {
          return -1;
        }
        return 1;
      });
    }
  }

  public start(httpclient: HttpClient) {
    if (this.state !== TaskState.FINISHED) {
      this.startNextOperation(httpclient);
    }
  }

  private startNextOperation(httpclient: HttpClient) {
    let nextoperation = -1;

    for (let i = 0; i < this.operations.length; i++) {
      if (this.operations[ i ].state !== TaskState.FINISHED) {
        nextoperation = i;
        break;
      }
    }

    if (nextoperation === -1) {
      // all finished
      this._state = TaskState.FINISHED;
    } else {
      if (nextoperation === 0) {
        this._state = TaskState.READY;
      } else {
        this._state = TaskState.PROCESSING;
      }
      this.operations[ nextoperation ].start(this.files, this.operations, httpclient);
      this.operations[ nextoperation ].statechange.subscribe(
        (event) => {
          if (event.newState === TaskState.FINISHED) {
            this.startNextOperation(httpclient);
          }
        });
    }
  }

  public getOperationByID(id: number) {
    return this.operations.find((a) => {
      return (a.id === id);
    });
  }
}
