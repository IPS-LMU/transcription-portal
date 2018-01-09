import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs/Observable';
import {ReplaySubject} from 'rxjs/ReplaySubject';
import {isNullOrUndefined} from 'util';
import {SubscriptionManager} from '../../subscription-manager';
import {FileInfo} from './fileInfo';
import {Operation} from './operation';
import {Subject} from 'rxjs/Subject';

export enum TaskState {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR'
}

export class Task {
  get language(): any {
    return this._language;
  }

  set language(value: any) {
    this._language = value;
  }

  static counter = 0;
  private opstatesubj: Subject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = new ReplaySubject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }>();
  public opstatechange: Observable<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = this.opstatesubj.asObservable();

  private statesubj: Subject<{
    oldState: TaskState;
    newState: TaskState;
  }> = new ReplaySubject<{
    oldState: TaskState;
    newState: TaskState;
  }>();
  public statechange: Observable<{
    oldState: TaskState;
    newState: TaskState;
  }> = this.statesubj.asObservable();


  get operations(): Operation[] {
    return this._operations;
  }

  get files(): FileInfo[] {
    return this._files;
  }

  private _language = null;

  private _files: FileInfo[];
  // operations that have to be done
  private _operations: Operation[] = [];
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  public mouseover = false;

  constructor(files: FileInfo[], operations: Operation[]) {
    this._id = ++Task.counter;
    this._files = files;
    this.sortFilesArray();

    // clone operations param
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i].clone(this);
      const subscription = operation.statechange.subscribe(
        (event) => {
          if (event.newState === TaskState.ERROR) {
            this.changeState(TaskState.ERROR);
          }

          this.opstatesubj.next({
            opID: operation.id,
            oldState: event.oldState,
            newState: event.newState
          });

          if (event.newState === TaskState.FINISHED) {
            subscription.unsubscribe();
          }
        }
      );

      this.operations.push(operation);
    }

    this.changeState(TaskState.PENDING);
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

  public start(httpclient: HttpClient, test = false) {
    if (this.state !== TaskState.FINISHED) {
      this.startNextOperation(httpclient, test);
    }
  }

  private startNextOperation(httpclient: HttpClient, test = false) {
    let nextoperation = -1;

    for (let i = 0; i < this.operations.length; i++) {
      if (this.operations[i].state !== TaskState.FINISHED) {
        nextoperation = i;
        break;
      }
    }

    if (nextoperation === -1) {
      // all finished
      this.changeState(TaskState.FINISHED);
    } else {
      const operation = this.operations[nextoperation];
      if (operation.state !== TaskState.FINISHED) {
        this.changeState(operation.state);
        const subscription = this.operations[nextoperation].statechange.subscribe(
          (event) => {
            if (event.newState === TaskState.FINISHED) {
              subscription.unsubscribe();
              this.startNextOperation(httpclient);
            }
          },
          (error) => {
            console.error(error);
          },
          () => {
          });

        this.operations[nextoperation].start(this.files, this.operations, httpclient);
      }
    }
  }

  public restart(http: HttpClient) {
    this.changeState(TaskState.PROCESSING);
    this.start(http, true);
  }

  public restartFailedOperation(httpclient) {
    for (let i = 0; i < this.operations.length; i++) {
      const operation = this.operations[i];

      if (operation.state === TaskState.ERROR) {
        // restart failed operation
        operation.changeState(TaskState.READY);
        this.changeState(TaskState.PENDING);
        break;
      }
    }
  }

  private changeState(state: TaskState) {
    const oldstate = this._state;
    this._state = state;

    if (oldstate !== state) {
      this.statesubj.next({
        oldState: oldstate,
        newState: state
      });
    }
  }

  public getOperationByID(id: number) {
    return this.operations.find((a) => {
      return (a.id === id);
    });
  }

  public destroy() {
    this.subscrmanager.destroy();
  }
}
