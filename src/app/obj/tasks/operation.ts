import {HttpClient} from '@angular/common/http';
import {SafeHtml} from '@angular/platform-browser';
import {Observable} from 'rxjs/Observable';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../fileInfo';
import {Task} from './index';
import {TaskState} from './task';
import {Subject} from 'rxjs/Subject';

export class Operation {
  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
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

  public constructor(name: string, icon?: string, task?: Task, state?: TaskState) {
    this._id = ++Operation.counter;
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

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    console.error('start not implemented');
  };

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
  }

  public clone(task?: Task): Operation {
    const selected_task = (isNullOrUndefined(task)) ? this.task : task;
    return new Operation(this.name, this.icon, selected_task, this.state);
  }

  onMouseOver() {
  }

  onMouseEnter() {
  }

  onMouseLeave() {
  }

  toAny(): any {
    let result = {
      id: this.id,
      name: this.name,
      state: this.state,
      protocol: this.protocol,
      time: this.time,
      enabled: this.enabled,
      results: []
    };

    // result data
    for (let i = 0; i < this.results.length; i++) {
      const resultObj = this.results[i];
      result.results.push(resultObj.toAny());
    }

    return result;
  }
}
