import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ServiceProvider } from '@octra/ngx-components';
import { last, SubscriptionManager } from '@octra/utilities';
import { FileInfo, FileInfoSerialized } from '@octra/web-media';
import { Observable, Subject } from 'rxjs';
import { IDBTaskItem } from '../../indexedDB';
import { Task, TaskStatus } from '../tasks';

export interface IOperation {
  id: number;
  name: string;
  enabled: boolean;
  rounds: OperationProcessingRoundSerialized[];
  serviceProvider?: string;
  /*
  language?: string;
  mausLanguage?: string;
  summarizationMaxNumberOfWords?: string;
   */
}

export interface IOperationProcessingRoundWithoutResults {
  status: TaskStatus;
  time?: {
    start: number;
    duration?: number;
  };
  protocol?: string;
}

export interface OperationProcessingRoundSerialized extends IOperationProcessingRoundWithoutResults {
  results: FileInfoSerialized[];
}

export class OperationProcessingRound implements IOperationProcessingRoundWithoutResults {
  results: FileInfo[] = [];
  status!: TaskStatus;
  time?: { start: number; duration?: number };
  protocol?: string;

  get lastResult(): FileInfo | undefined {
    return last(this.results);
  }

  constructor(partial?: Partial<OperationProcessingRound>) {
    Object.assign(this, partial);
  }

  protected async serializeResults(): Promise<FileInfoSerialized[]> {
    const promises: Promise<FileInfoSerialized>[] = [];
    for (const resultObj of this.results) {
      promises.push(resultObj.toAny());
    }

    return Promise.all(promises);
  }

  async toAny(): Promise<OperationProcessingRoundSerialized> {
    return {
      protocol: this.protocol,
      results: await this.serializeResults(),
      status: this.status,
      time: this.time,
    };
  }

  static fromAny(obj: OperationProcessingRoundSerialized): OperationProcessingRound {
    return new OperationProcessingRound({
      results: obj.results.map((a) => FileInfo.fromAny(a)),
      time: obj.time,
      protocol: obj.protocol?.replace('¶', ''),
      status: obj.status,
    });
  }
}

export interface OperationOptions {
  asr?: {
    language?: string;
    provider?: ServiceProvider;
    diarization?: {
      enabled?: boolean;
      speakers?: number;
    };
  };
  maus?: {
    language?: string;
  };
  summarization?: {
    provider?: ServiceProvider;
    numberOfWords?: number;
  };
  translation?: {
    language?: string;
  };
}

export abstract class Operation {
  static counter = 0;
  public abstract resultType?: string;
  public mouseover = false;
  public changes$: Subject<Operation> = new Subject<Operation>();
  private readonly _shortTitle: string | undefined;
  private readonly _id: number;

  protected subscrManager = new SubscriptionManager();

  protected constructor(
    private _name: string,
    protected _commands: string[],
    title?: string,
    shortTitle?: string,
    private _task?: Task,
    id?: number,
    serviceProvider?: ServiceProvider,
  ) {
    if (id === null || id === undefined) {
      this._id = ++Operation.counter;
    } else {
      this._id = id;
    }

    if (title) {
      this._title = title;
    }

    this._shortTitle = shortTitle;
    this._serviceProvider = serviceProvider;
  }

  public abstract start: (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient, accessCode?: string) => Promise<void>;

  get shortTitle(): string | undefined {
    return this._shortTitle;
  }

  get task(): Task | undefined {
    return this._task;
  }

  get isFinished() {
    return this.state === TaskStatus.FINISHED;
  }

  public get lastRound(): OperationProcessingRound | undefined {
    if (this.rounds.length > 0) {
      return this.rounds[this.rounds.length - 1];
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

  protected _rounds: OperationProcessingRound[] = [];

  get rounds(): OperationProcessingRound[] {
    return this._rounds;
  }

  get state(): TaskStatus {
    return this.lastRound?.status ?? TaskStatus.PENDING;
  }

  set state(value: TaskStatus) {
    if (this.lastRound?.status) {
      this.lastRound.status = value;
    } else {
      console.error("Can't set state value because lastResult is undefined");
    }
  }

  get name(): string {
    return this._name;
  }

  protected _title = '';

  get title(): string {
    return this._title;
  }

  get protocol(): string | undefined {
    return this.lastRound?.protocol;
  }

  set protocol(value: string | undefined) {
    if (this.lastRound) {
      this.lastRound.protocol = value;
    } else {
      console.error(`Can't set protocol for operation ${this.id} (${this.name}) because lastResult is undefined.`);
    }
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

  get time(): { start: number; duration?: number } | undefined {
    return this.lastRound?.time;
  }

  set time(value: { start: number; duration?: number } | undefined) {
    if (this.lastRound) {
      this.lastRound.time = value;
    } else {
      console.error("Can't set time value because lastRound is undefined");
    }
  }

  private _enabled = true;

  get enabled(): boolean {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    this.changes$.next(this);
  }

  public getStateIcon = (sanitizer: DomSanitizer, state: TaskStatus): SafeHtml => {
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
    const oldstate = this.state;
    this.state = state;

    if (oldstate !== state) {
      this.changes$.next(this);
    }

    // check if there is any runable operation after this one.
    let nextOP = this.nextOperation;

    while (nextOP) {
      const nextOP2 = nextOP.enabled && nextOP.state !== TaskStatus.SKIPPED ? nextOP : null;
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

  public abstract fromAny(operationObj: IOperation, commands: string[], task: Task, taskObj: IDBTaskItem): Operation;

  async toAny(): Promise<IOperation> {
    throw new Error('Not implemented.');
  }

  protected updateProtocol(protocol: string) {
    this.protocol = protocol;
    this.parseProtocol();
  }

  private parseProtocol() {
    if (!this.protocol) {
      this._parsedProtocol = [];
    } else {
      const result: {
        type: 'WARNING' | 'ERROR';
        message: string;
      }[] = [];
      const text = this.protocol.replace(/<br\/>/g, '\n');
      const regex = /((?:ERROR)|(?:WARNING)): (.+)$/gm;
      let match = regex.exec(text);

      while (match !== null) {
        result.push({
          type: match[1] as 'WARNING' | 'ERROR',
          message: match.length < 3 || !match[2] ? '' : match[2].replace(/(ACCESSCODE=)([^&\n]+)/g, '$1****'),
        });
        match = regex.exec(text);
      }

      this._parsedProtocol = result;
    }
  }

  protected throwError(error: Error) {
    if (this.lastRound) {
      this.lastRound.time = this.lastRound.time
        ? {
            ...this.lastRound.time,
            duration: Date.now() - this.lastRound.time.start,
          }
        : undefined;
    }
    console.error(error);
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

  // TODO implement onMouseClick()

  public overwriteOptions(options: OperationOptions) {
    throw new Error('Not implemented');
  }

  protected async serializeProcessingRounds(): Promise<OperationProcessingRoundSerialized[]> {
    const promises: Promise<OperationProcessingRoundSerialized>[] = [];
    for (const round of this.rounds) {
      promises.push(round.toAny());
    }

    return Promise.all(promises);
  }

  addProcessingRound() {
    this._rounds.push(
      new OperationProcessingRound({
        status: TaskStatus.PENDING,
        results: [],
      }),
    );
  }

  removeRoundsByIndex(start: number, length: number) {
    this._rounds.splice(start, length);
    this.changes$.next(this);
  }

  removeResultsByIndex(roundIndex: number, start: number, length: number) {
    this._rounds[roundIndex].results.splice(start, length);
    this.changes$.next(this);
  }
}

export interface IAccessCode {
  name: string;
  value: string;
}
