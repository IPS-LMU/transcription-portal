import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FileInfo } from '@octra/web-media';
import { Observable, Subject } from 'rxjs';
import { OHLanguageObject, OHService } from '../oh-config';
import { Task, TaskState } from '../tasks';

export abstract class Operation {
  static counter = 0;
  public abstract resultType?: string;
  public mouseover = false;
  public changed: Subject<void> = new Subject<void>();
  public abstract start: (
    languageObject: OHLanguageObject,
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode: string
  ) => void;
  private readonly _shortTitle: string | undefined;
  private statesubj: Subject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = new Subject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }>();
  public statechange: Observable<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = this.statesubj.asObservable();
  private readonly _id: number;

  protected constructor(
    private _name: string,
    protected _commands: string[],
    title?: string,
    shortTitle?: string,
    private _task?: Task,
    state?: TaskState,
    id?: number
  ) {
    if (id === null || id === undefined) {
      this._id = ++Operation.counter;
    } else {
      this._id = id;
    }

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

  get shortTitle(): string | undefined {
    return this._shortTitle;
  }

  get task(): Task | undefined {
    return this._task;
  }

  get isFinished() {
    return this.state === TaskState.FINISHED;
  }

  public get lastResult(): FileInfo | undefined {
    if (this.results.length > 0) {
      return this.results[this.results.length - 1];
    }
    return undefined;
  }

  protected _parsedProtocol: {
    type: 'WARNING' | 'ERROR';
    message: string;
  }[] = [];

  get parsedProtocol(): { type: 'WARNING' | 'ERROR'; message: string }[] {
    return this._parsedProtocol;
  }

  public get previousOperation(): Operation | undefined {
    if (!this.task) {
      throw new Error('task is undefined');
    }
    const index = this.task.operations.findIndex((op: Operation) => {
      return op.id === this.id;
    });

    if (index > 0) {
      return this.task.operations[index - 1];
    }

    return undefined;
  }

  public get nextOperation(): Operation | undefined {
    if (this.task) {
      const index = this.task.operations.findIndex((op: Operation) => {
        return op.id === this.id;
      });

      if (index < this.task.operations.length - 1) {
        return this.task.operations[index + 1];
      }
    }

    return undefined;
  }

  get id(): number {
    return this._id;
  }

  private _estimatedEnd: number | undefined;

  get estimatedEnd(): number | undefined {
    return this._estimatedEnd;
  }

  set estimatedEnd(value: number | undefined) {
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

  protected _providerInformation: OHService | undefined;

  get providerInformation(): OHService | undefined {
    return this._providerInformation;
  }

  set providerInformation(value: OHService | undefined) {
    this._providerInformation = value;
  }

  protected _time: {
    start: number;
    duration: number;
  } = {
    start: 0,
    duration: 0,
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

  public getStateIcon = (
    sanitizer: DomSanitizer,
    state: TaskState
  ): SafeHtml => {
    let result = '';

    switch (state) {
      case TaskState.PENDING:
        result = '';
        break;
      case TaskState.UPLOADING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.PROCESSING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskState.READY:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public getStateIcon2 = (state: TaskState): string => {
    let result = '';

    switch (state) {
      case TaskState.PENDING:
        result = '';
        break;
      case TaskState.UPLOADING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.PROCESSING:
        result = `<i class="bi bi-gear-fill spin"></i>`;
        break;
      case TaskState.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskState.READY:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public changeState(state: TaskState) {
    const oldstate = this._state;
    this._state = state;

    if (oldstate !== state) {
      this.statesubj.next({
        opID: this.id,
        oldState: oldstate,
        newState: state,
      });
    }

    // check if there is any runable operation after this one.
    let nextOP = this.nextOperation;

    while (nextOP) {
      const nextOP2 =
        nextOP.enabled && nextOP.state !== TaskState.SKIPPED ? nextOP : null;
      if (nextOP2 !== null) {
        break;
      }
      nextOP = nextOP.nextOperation;
    }

    if (state === TaskState.FINISHED && nextOP === null) {
      this.task?.changeState(TaskState.FINISHED);
    }
  }

  public abstract clone(task?: Task): Operation;

  public abstract fromAny(
    operationObj: any,
    commands: string[],
    task: Task
  ): Operation;

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
        results: [],
      };

      // result data
      const promises: Promise<any>[] = [];
      for (const resultObj of this.results) {
        promises.push(resultObj.toAny());
      }

      if (promises.length > 0) {
        Promise.all(promises)
          .then((values) => {
            result.results = values as never[];
            resolve(result);
          })
          .catch((error) => {
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
      const result: {
        type: 'WARNING' | 'ERROR';
        message: string;
      }[] = [];
      const text = protocol.replace(/<br\/>/g, '\n');
      const regex = /((?:ERROR)|(?:WARNING)): (.+)$/gm;
      let match = regex.exec(text);

      while (match !== null) {
        result.push({
          type: match[1] as 'WARNING' | 'ERROR',
          message:
            match.length < 3 || !match[2]
              ? ''
              : match[2].replace(/(ACCESSCODE=)([^&\n]+)/g, '$1****'),
        });
        match = regex.exec(text);
      }

      this._parsedProtocol = result;
    }
  }

  public onMouseEnter() {}
  public onMouseLeave() {}
  public onMouseOver() {}
}

export interface IAccessCode {
  name: string;
  value: string;
}
