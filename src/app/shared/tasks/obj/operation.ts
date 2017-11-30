import { HttpClient } from '@angular/common/http';
import { SecurityContext } from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';
import { Observable } from 'rxjs/Observable';
import { ReplaySubject } from 'rxjs/ReplaySubject';
import { isNullOrUndefined } from 'util';
import { FileInfo } from './fileInfo';
import { TaskState } from './task';

export class Operation {
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

  get time(): { start: number; end: number } {
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

  static counter = 0;
  private _estimated_end: number;
  protected _results: FileInfo[] = [];

  protected _state: TaskState;
  protected _name: string;
  protected _icon = '';
  protected _protocol = '';
  protected _time: {
    start: number;
    end: number;
  } = {
    start: 0,
    end  : 0
  };
  private statesubj: ReplaySubject<{
    oldState: TaskState;
    newState: TaskState
  }> = new ReplaySubject<{
    oldState: TaskState;
    newState: TaskState
  }>();
  public statechange: Observable<{
    oldState: TaskState;
    newState: TaskState
  }> = this.statesubj.asObservable();

  public constructor(name: string, icon?: string, state?: TaskState) {
    this._id = ++Operation.counter;
    this._name = name;

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
        result = '<i class="fa fa-spinner fa-spin fa-fw"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case(TaskState.FINISHED):
        result = '<span class="glyphicon glyphicon-ok"></span>';
        break;
      case(TaskState.READY):
        result = '<span class="glyphicon glyphicon-info-sign"></span>';
        break;
      case(TaskState.ERROR):
        result = '<span class="glyphicon glyphicon-remove"></span>';
        break;
    }

    return sanitizer.sanitize(SecurityContext.HTML, result);
  };

  public start = (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient) => {
    console.log('start not implemented');
  };

  public changeState(state: TaskState) {
    const oldstate = this._state;
    this._state = state;
    this.statesubj.next({
      oldState: oldstate,
      newState: state
    });
    if (state === TaskState.FINISHED) {
      this.statesubj.complete();
    }
  }

  public clone(): Operation {
    const result = new Operation(this.name, this.icon, this.state);
    result.start = this.start;
    return result;
  }
}
