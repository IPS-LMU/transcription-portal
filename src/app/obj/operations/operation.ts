import {HttpClient} from '@angular/common/http';
import {SafeHtml} from '@angular/platform-browser';
import {Observable} from 'rxjs/Observable';
import {FileInfo} from '../fileInfo';
import {Subject} from 'rxjs/Subject';
import {Task, TaskState} from '../tasks/task';

export abstract class Operation {
  get shortTitle(): string {
    return this._shortTitle;
  }

  get description(): string {
    return this._description;
  }

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

  get title(): string {
    return this._title;
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
    if (!(this.task === null || this.task === undefined)) {
      const index = this.task.operations.findIndex((op) => {
          if (op.id === this.id) {
            return true;
          }
        }
      );

      if (index < this.task.operations.length - 1) {
        return this.task.operations[index + 1];
      }
    }

    return null;
  }

  public constructor(name: string, title?: string, shortTitle?: string, task?: Task, state?: TaskState, id?: number) {
    if ((id === null || id === undefined)) {
      this._id = ++Operation.counter;
    } else {
      this._id = id;
    }
    this._name = name;
    this._task = task;

    if (!(title === null || title === undefined)) {
      this._title = title;
    }

    if (!(shortTitle === null || shortTitle === undefined)) {
      this._shortTitle = shortTitle;
    }

    if (!(state === null || state === undefined)) {
      this.changeState(state);
    } else {
      this.changeState(TaskState.PENDING);
    }
  }

  get id(): number {
    return this._id;
  }

  static counter = 0;
  public abstract resultType;
  private _estimated_end: number;
  protected _results: FileInfo[] = [];

  public mouseover = false;

  private _task: Task = null;
  protected _state: TaskState = TaskState.PENDING;
  protected _name: string;
  protected _title = '';
  protected _protocol = '';
  protected _description = '';
  private _shortTitle: string;

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

  private _id: number;

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
  }

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
  }

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    console.error('start not implemented');
  }

  public changeState(state: TaskState) {
    const oldstate = this._state;
    this._state = state;

    if (oldstate !== state) {
      this.statesubj.next({
        opID: this.id,
        oldState: oldstate,
        newState: state
      });
    }

    let nextOP = this.nextOperation;

    while (nextOP !== null) {
      nextOP = this.nextOperation;
      nextOP = (nextOP.enabled && nextOP.state !== TaskState.SKIPPED) ? nextOP : null;
      if (nextOP !== null) {
        break;
      }
    }

    if (state === TaskState.FINISHED && nextOP === null) {
      this.task.changeState(TaskState.FINISHED);
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
      const result = {
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
