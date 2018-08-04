import {HttpClient} from '@angular/common/http';
import {SafeHtml} from '@angular/platform-browser';
import {Observable} from 'rxjs/Observable';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../fileInfo';
import {Subject} from 'rxjs/Subject';
import {Task, TaskState} from './';

export abstract class Operation {
  public abstract resultType;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.changed.next();
  }

  get task(): Task {
    return this._task;
  }

  get protocol(): string {
    return this._protocol;
  }

  set estimated_end(value: number) {
    this._estimated_end = value;
  }

  get estimated_end(): number {
    return this._estimated_end;
  }

  get results(): FileInfo[] {
    return this._results;
  }

  get time(): { start: number; duration: number } {
    return this._time;
  }

  get state(): TaskState {
    return this._state;
  }

  get name(): string {
    return this._name;
  }

  get icon(): string {
    return this._icon;
  }

  get isFinished() {
    return this.state === TaskState.FINISHED;
  }

  public get lastResult(): FileInfo {
    if (this.results.length > 0) {
      return this.results[this.results.length - 1];
    }
    return null;
  }

  public get previousOperation(): Operation {
    const index = this.task.operations.findIndex((op) => {
        if (op.id === this.id) {
          return true;
        }
      }
    );

    if (index > 0) {
      return this.task.operations[index - 1];
    }

    return null;
  }

  public get nextOperation(): Operation {
    const index = this.task.operations.findIndex((op) => {
        if (op.id === this.id) {
          return true;
        }
      }
    );

    if (index < this.task.operations.length - 1) {
      return this.task.operations[index + 1];
    }

    return null;
  }

  static counter = 0;
  private _estimated_end: number;
  protected _results: FileInfo[] = [];

  public mouseover = false;

  private _task: Task = null;
  protected _state: TaskState = TaskState.PENDING;
  protected _name: string;
  protected _icon = '';
  protected _protocol = '';
  protected _time: {
    start: number;
    duration: number;
  } = {
    start: 0,
    duration: 0
  };
  private _enabled = true;

  private statesubj: Subject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState
  }> = new Subject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState
  }>();
  public statechange: Observable<{
    opID: number,
    oldState: TaskState;
    newState: TaskState
  }> = this.statesubj.asObservable();

  public changed: Subject<void> = new Subject<void>();

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState, id?: number) {
    if (isNullOrUndefined(id)) {
      this._id = ++Operation.counter;
    } else {
      this._id = id;
    }
    this._name = name;
    this._task = task;

    if (!isNullOrUndefined(icon)) {
      this._icon = icon;
    }

    if (!isNullOrUndefined(state)) {
      this.changeState(state);
    } else {
      this.changeState(TaskState.PENDING);
    }
  }

  private _id: number;

  get id(): number {
    return this._id;
  }

  public getStateIcon = (sanitizer, state: TaskState): SafeHtml => {
    let result = '';

    switch (state) {
      case(TaskState.PENDING):
        result = '';
        break;
      case(TaskState.UPLOADING):
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.PROCESSING):
        result = '<i class="fa fa-cog fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Processing...</span>';
        break;
      case(TaskState.FINISHED):
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
        break;
      case(TaskState.READY):
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public getStateIcon2 = (state: TaskState): String => {
    let result = '';

    switch (state) {
      case(TaskState.PENDING):
        result = '';
        break;
      case(TaskState.UPLOADING):
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.PROCESSING):
        result = '<i class="fa fa-cog fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Processing...</span>';
        break;
      case(TaskState.FINISHED):
        result = '<i class="fa fa-check" aria-hidden="true"></i>';
        break;
      case(TaskState.READY):
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>';
        break;
      case(TaskState.ERROR):
        result = '<i class="fa fa-times" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    console.error('start not implemented');
  };

  public changeState(state: TaskState) {
    console.log(`CHANGE op state to ${state}!`);
    const oldstate = this._state;
    this._state = state;

    if (oldstate !== state) {
      this.statesubj.next({
        opID: this.id,
        oldState: oldstate,
        newState: state
      });
    }
  }

  public abstract clone(task?: Task): Operation;

  public abstract fromAny(operationObj: any, task: Task): Operation;

  onMouseOver() {
  }

  onMouseEnter() {
  }

  onMouseLeave() {
  }

  toAny(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      let result = {
        id: this.id,
        name: this.name,
        state: this.state,
        protocol: this.protocol,
        time: this.time,
        enabled: this.enabled,
        webService: '',
        results: []
      };

      // result data
      const promises: Promise<any>[] = [];
      for (let i = 0; i < this.results.length; i++) {
        const resultObj = this.results[i];
        promises.push(resultObj.toAny());
      }

      if (promises.length > 0) {
        Promise.all(promises).then((values) => {
          result.results = values;
          resolve(result);
        }).catch((error) => {
          reject(error);
        });
      } else {
        resolve(result);
      }
    });
  }
}
