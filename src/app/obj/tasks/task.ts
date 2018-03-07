import {HttpClient} from '@angular/common/http';
import {Observable} from 'rxjs/Observable';
import {ReplaySubject} from 'rxjs/ReplaySubject';
import {isNullOrUndefined} from 'util';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {FileInfo} from '../fileInfo';
import {Subject} from 'rxjs/Subject';
import {TaskDirectory} from './taskDirectory';
import {AudioInfo} from '../audio';
import {Operation} from './index';

export enum TaskState {
  INACTIVE = 'INACTIVE',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  SKIPPED = 'SKIPPED',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR'
}

export class Task {
  get type(): string {
    return this._type;
  }

  get directory(): TaskDirectory {
    return this._directory;
  }

  get language(): any {
    return this._language;
  }

  set language(value: any) {
    this._language = value;
  }

  public static counter = 0;
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
  private _directory: TaskDirectory;
  private _type = 'task';

  public mouseover = false;

  constructor(files: FileInfo[], operations: Operation[], directory?: TaskDirectory, id?: number) {
    if (isNullOrUndefined(id)) {
      this._id = ++Task.counter;
    } else {
      this._id = id;
    }
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
            if (isNullOrUndefined(operation.nextOperation)) {
              this.changeState(TaskState.FINISHED);
            }
            subscription.unsubscribe();
          }
        }
      );

      this.operations.push(operation);
    }

    this.changeState(TaskState.PENDING);
    this._directory = directory;
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
      const operation = this.operations[i];
      if (!operation.enabled && operation.state !== TaskState.SKIPPED) {
        operation.changeState(TaskState.SKIPPED);
      }
      if (operation.enabled && this.operations[i].state !== TaskState.FINISHED) {
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
        this.changeState(TaskState.PROCESSING);
        const subscription = this.operations[nextoperation].statechange.subscribe(
          (event) => {
            if (event.newState === TaskState.FINISHED) {
              subscription.unsubscribe();
              this.startNextOperation(httpclient);
            } else {
              if (event.newState === TaskState.READY) {
                this.changeState(TaskState.READY);
              }
            }
          },
          (error) => {
            console.error(error);
          },
          () => {
          });

        let files;
        if (this.files.length > 0 && !isNullOrUndefined(this.files[0].file)) {
          files = this.files;
        } else {
          files = this.operations[0].results;
        }

        this.operations[nextoperation].start(files, this.operations, httpclient);
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
        this.restart(httpclient);
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

  public static fromAny(taskObj: any, defaultOperations: Operation[]): Task {
    const task = new Task([], [], null, taskObj.id);
    task.language = taskObj.language;

    for (let i = 0; i < taskObj.files.length; i++) {
      const file = taskObj.files[i];
      const audioInfo = new AudioInfo(file.fullname, file.type, file.size, file.sampleRate, file.duration, file.channels, file.bitsPerSecond);
      task.files.push(audioInfo);
    }

    for (let i = 0; i < taskObj.operations.length; i++) {
      const operationObj = taskObj.operations[i];
      for (let j = 0; j < defaultOperations.length; j++) {
        const op = defaultOperations[j];
        if (op.name === operationObj.name) {
          const operation = op.fromAny(operationObj, task);
          if (operation.state === TaskState.UPLOADING || operation.state === TaskState.PROCESSING) {
            operation.changeState(TaskState.PENDING);
          }
          task.operations.push(operation);
          break;
        }
      }
    }

    return task;
  }

  public toAny(): any {
    const result = {
      id: this.id,
      type: 'task',
      state: this.state,
      folderPath: '',
      language: this.language,
      files: [],
      operations: []
    };

    // read file data
    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];

      let fileObj = file.toAny();

      if (file instanceof AudioInfo) {
        const audioFile = <AudioInfo> file;

        fileObj['sampleRate'] = audioFile.samplerate;
        fileObj['bitsPerSecond'] = audioFile.bitrate;
        fileObj['channels'] = audioFile.channels;
        fileObj['duration'] = audioFile.duration.samples;
      }

      result.files.push(fileObj);
    }

    // read operation data
    for (let i = 0; i < this.operations.length; i++) {
      const operation = this.operations[i].toAny();

      result.operations.push(operation);
    }

    result.folderPath = (this._directory === undefined) ? '' : this._directory.path;

    console.log(result);
    return result;
  }
}
