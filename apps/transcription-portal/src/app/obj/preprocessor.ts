import {Subject} from 'rxjs';
import {Task, TaskDirectory} from './tasks';
import {DirectoryInfo, FileInfo} from '@octra/utilities';

/**
 * Class that manages the files added to the queue and the process of converting files to Tasks
 */

export enum State {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED',
  REMOVED = 'REMOVED',
  ERROR = 'ERROR'
}

export class QueueItem {
  private static counter = 0;
  public results: (Task | TaskDirectory)[] = [];
  private readonly _id: number;

  constructor(file: (FileInfo | DirectoryInfo)) {
    this._file = file;
    this._id = ++QueueItem.counter;
    this._state = State.PENDING;
  }

  get id(): number {
    return this._id;
  }

  private _file: (FileInfo | DirectoryInfo);

  get file(): (FileInfo | DirectoryInfo) {
    return this._file;
  }

  set file(value: FileInfo | DirectoryInfo) {
    this._file = value;
  }

  private _state: State;

  get state(): State {
    return this._state;
  }

  set state(value: State) {
    this._state = value;
  }
}

export class Preprocessor {
  constructor() {
    this._itemAdded.subscribe(this.onItemAdded);
  }

  private _queue: QueueItem[] = [];

  get queue(): QueueItem[] {
    return this._queue;
  }

  private _statechange = new Subject<{
    item: QueueItem,
    oldState: State
  }>();

  get statechange(): Subject<{
    item: QueueItem,
    oldState: State
  }> {
    return this._statechange;
  }

  private _itemProcessed = new Subject<QueueItem>();

  get itemProcessed(): Subject<QueueItem> {
    return this._itemProcessed;
  }

  private _itemAdded = new Subject<QueueItem>();

  get itemAdded(): Subject<QueueItem> {
    return this._itemAdded;
  }

  private _itemRemoved = new Subject<number>();

  get itemRemoved(): Subject<number> {
    return this._itemRemoved;
  }

  public process: (queueItem: QueueItem) => Promise<(Task | TaskDirectory)[]> = () => {
    return new Promise<(Task | TaskDirectory)[]>(()=>{});
  }

  public changeState(item: QueueItem, state: State) {
    const oldState = item.state;
    item.state = state;

    this.statechange.next({
      item,
      oldState
    });
  }

  public addToQueue(file: (FileInfo | DirectoryInfo)) {
    const queueItem = new QueueItem(file);

    this._queue.push(queueItem);
    this._itemAdded.next(queueItem);
  }

  public removeFromQueue(id: number): boolean {
    const index = this._queue.findIndex((a) => {
      return a.id === id;
    });

    if (index > -1) {
      this._queue.splice(index, 1);
      this._itemRemoved.next(id);
      return true;
    }
    this._itemRemoved.error('id not found in queue');
    return false;
  }

  public destroy() {
    this._statechange.complete();
    this._itemAdded.complete();
    this._itemRemoved.complete();
  }

  public getHashString(filename: string, size: number) {
    return `${filename}_${size}`;
  }

  private onItemAdded = (newItem: QueueItem) => {

    this.changeState(newItem, State.PROCESSING);
    this.process(newItem).then((result) => {
        if (!(result === null || result === undefined)) {
          newItem.results = result;
          this.changeState(newItem, State.FINISHED);
          this.removeFromQueue(newItem.id);
          this._itemProcessed.next(newItem);
        }
      }
    ).catch((err) => {
      this.removeFromQueue(newItem.id);
    })
    ;
  }
}
