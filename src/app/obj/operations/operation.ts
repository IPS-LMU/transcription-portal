import {HttpClient} from '@angular/common/http';
import {SafeHtml} from '@angular/platform-browser';
import {Observable, Subject} from 'rxjs';
import {Task, TaskState} from '../tasks';
import {OHLanguageObject, OHService} from '../oh-config';
import {FileInfo, isUnset} from '@octra/utilities';

export abstract class Operation {
  static counter = 0;
  public abstract resultType;
  public mouseover = false;
  public changed: Subject<void> = new Subject<void>();
  public abstract start: (languageObject: OHLanguageObject, inputs: FileInfo[], operations: Operation[],
                          httpclient: HttpClient, accessCode: string) => void;
  protected readonly _commands: string[];
  private readonly _task: Task = null;
  private readonly _shortTitle: string;
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
  private readonly _id: number;

  protected constructor(name: string, commands: string[], title?: string, shortTitle?: string,
                        task?: Task, state?: TaskState, id?: number) {
    if ((id === null || id === undefined)) {
      this._id = ++Operation.counter;
    } else {
      this._id = id;
    }
    this._name = name;
    this._task = task;
    this._commands = commands;

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

  get shortTitle(): string {
    return this._shortTitle;
  }

  get task(): Task {
    return this._task;
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

  protected _parsedProtocol: {
    type: 'WARNING' | 'ERROR',
    message: string
  }[] = [];

  get parsedProtocol(): { type: 'WARNING' | 'ERROR'; message: string }[] {
    return this._parsedProtocol;
  }

  public get previousOperation(): Operation | null {
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

  get id(): number {
    return this._id;
  }

  private _estimatedEnd: number;

  get estimatedEnd(): number {
    return this._estimatedEnd;
  }

  set estimatedEnd(value: number) {
    this._estimatedEnd = value;
  }

  protected _results: FileInfo[] = [];

  get results(): FileInfo[] {
    return this._results;
  }

  protected _state: TaskState = TaskState.PENDING;

  get state(): TaskState {
    return this._state;
  }

  protected _name: string;

  get name(): string {
    return this._name;
  }

  protected _title = '';

  get title(): string {
    return this._title;
  }

  private _protocol = '';

  get protocol(): string {
    return this._protocol;
  }

  protected _description = '';

  get description(): string {
    return this._description;
  }

  protected _providerInformation: OHService;

  get providerInformation(): OHService {
    return this._providerInformation;
  }

  set providerInformation(value: OHService) {
    this._providerInformation = value;
  }

  protected _time: {
    start: number;
    duration: number;
  } = {
    start: 0,
    duration: 0
  };

  get time(): { start: number; duration: number } {
    return this._time;
  }

  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.changed.next();
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
  }

  public getStateIcon2 = (state: TaskState): string => {
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

    // check if there is any runable operation after this one.
    let nextOP = this.nextOperation;

    while (nextOP !== null) {
      const nextOP2 = (nextOP.enabled && nextOP.state !== TaskState.SKIPPED) ? nextOP : null;
      if (nextOP2 !== null) {
        break;
      }
      nextOP = nextOP.nextOperation;
    }

    if (state === TaskState.FINISHED && nextOP === null) {
      this.task.changeState(TaskState.FINISHED);
    }
  }

  public abstract clone(task?: Task): Operation;

  public abstract fromAny(operationObj: any, commands: string[], task: Task): Operation;

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
      for (const resultObj of this.results) {
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

  protected updateProtocol(protocol: string) {
    this._protocol = protocol;
    this.parseProtocol(this._protocol);
  }

  private parseProtocol(protocol: string) {
    if (protocol === '') {
      this._parsedProtocol = [];
    } else {
      const result = [];
      const text = protocol.replace(/<br\/>/g, '\n');
      const regex = /((?:ERROR)|(?:WARNING)): (.+)$/gm;
      let match = regex.exec(text);

      while (match !== null) {
        result.push({
          type: match[1],
          message: (match.length < 3 || isUnset(match[2])) ? ''
            : match[2].replace(/(ACCESSCODE=)([^&\n]+)/g, '$1****')
        });
        match = regex.exec(text);
      }

      this._parsedProtocol = result;
    }
  }
}

export interface IAccessCode {
  name: string;
  value: string;
}
