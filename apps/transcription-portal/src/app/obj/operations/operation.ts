import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ServiceProvider } from '@octra/ngx-components';
import { SubscriptionManager } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Observable, Subject } from 'rxjs';
import { Task, TaskStatus } from '../tasks';

export interface IOperation {
  id: number;
  name: string;
  state: TaskStatus;
  protocol: string;
  time: {
    start: number;
    duration: number;
  };
  enabled: boolean;
  results: any[];
  serviceProvider?: string;
  language?: string;
}

export abstract class Operation {
  static counter = 0;
  public abstract resultType?: string;
  public mouseover = false;
  public changed: Subject<void> = new Subject<void>();
  private readonly _shortTitle: string | undefined;
  private statesubj: Subject<{
    opID: number;
    oldState: TaskStatus;
    newState: TaskStatus;
  }> = new Subject<{
    opID: number;
    oldState: TaskStatus;
    newState: TaskStatus;
  }>();
  public statechange: Observable<{
    opID: number;
    oldState: TaskStatus;
    newState: TaskStatus;
  }> = this.statesubj.asObservable();
  private readonly _id: number;

  protected subscrManager = new SubscriptionManager();

  protected constructor(
    private _name: string,
    protected _commands: string[],
    title?: string,
    shortTitle?: string,
    private _task?: Task,
    state?: TaskStatus,
    id?: number,
    serviceProvider?: ServiceProvider,
    language?: string,
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
      this.changeState(TaskStatus.PENDING);
    }

    this._serviceProvider = serviceProvider;
    this._language = language;
  }

  public abstract start: (
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode?: string,
  ) => void;

  get shortTitle(): string | undefined {
    return this._shortTitle;
  }

  get task(): Task | undefined {
    return this._task;
  }

  get isFinished() {
    return this.state === TaskStatus.FINISHED;
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

  protected _state: TaskStatus = TaskStatus.PENDING;

  get state(): TaskStatus {
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

  protected _serviceProvider?: ServiceProvider;

  get serviceProvider(): ServiceProvider | undefined {
    return this._serviceProvider;
  }

  set serviceProvider(value: ServiceProvider | undefined) {
    this._serviceProvider = value;
  }

  protected _language?: string;
  get language(): string | undefined {
    return this._language;
  }

  set language(value: string | undefined) {
    this._language = value;
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
    state: TaskStatus,
  ): SafeHtml => {
    let result = '';

    switch (state) {
      case TaskStatus.PENDING:
        result = '';
        break;
      case TaskStatus.UPLOADING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.PROCESSING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskStatus.READY:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public getStateIcon2 = (state: TaskStatus): string => {
    let result = '';

    switch (state) {
      case TaskStatus.PENDING:
        result = '';
        break;
      case TaskStatus.UPLOADING:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.PROCESSING:
        result = `<i class="bi bi-gear-fill spin"></i>`;
        break;
      case TaskStatus.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskStatus.READY:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public changeState(state: TaskStatus) {
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
        nextOP.enabled && nextOP.state !== TaskStatus.SKIPPED ? nextOP : null;
      if (nextOP2 !== null) {
        break;
      }
      nextOP = nextOP.nextOperation;
    }

    if (state === TaskStatus.FINISHED && nextOP === null) {
      this.task?.changeState(TaskStatus.FINISHED);
    }
  }

  public abstract clone(task?: Task): Operation;

  public abstract fromAny(
    operationObj: IOperation,
    commands: string[],
    task: Task,
    taskObj: any,
  ): Operation;

  toAny(): Promise<IOperation> {
    return new Promise<any>((resolve, reject) => {
      const result: IOperation = {
        id: this.id,
        name: this.name,
        state: this.state,
        protocol: this.protocol,
        time: this.time,
        enabled: this.enabled,
        results: [],
        serviceProvider: this.serviceProvider?.provider,
        language: this.language,
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

  protected throwError(error: Error) {
    console.error(error);
    this.time.duration = Date.now() - this.time.start;
    this.changeState(TaskStatus.ERROR);
    this.updateProtocol(error?.message?.replace(/\n/g, '<br/>'));
  }

  public destroy() {
    this.subscrManager.destroy();
  }

  public onMouseEnter() {
    // not implemented
  }
  public onMouseLeave() {
    // not implemented
  }
  public onMouseOver() {
    // not implemented
  }
}

export interface IAccessCode {
  name: string;
  value: string;
}
