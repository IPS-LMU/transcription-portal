import {Subject} from 'rxjs/Subject';
import {FileInfo} from './fileInfo';
import {DirectoryInfo} from './directoryInfo';
import {Task, TaskDirectory} from './tasks';
import {isNullOrUndefined} from 'util';

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
  set file(value: FileInfo | DirectoryInfo) {
    this._file = value;
  }

  set state(value: State) {
    this._state = value;
  }

  get state(): State {
    return this._state;
  }

  get id(): number {
    return this._id;
  }

  get file(): (FileInfo | DirectoryInfo) {
    return this._file;
  }

  private _file: (FileInfo | DirectoryInfo);
  private _id: number;
  private _state: State;
  public results: (Task | TaskDirectory)[] = [];

  private static counter = 0;

  constructor(file: (FileInfo | DirectoryInfo)) {
    this._file = file;
    this._id = ++QueueItem.counter;
    this._state = State.PENDING;
  }
}

export class Preprocessor {
  get itemProcessed(): Subject<QueueItem> {
    return this._itemProcessed;
  }

  get itemRemoved(): Subject<number> {
    return this._itemRemoved;
  }

  get itemAdded(): Subject<QueueItem> {
    return this._itemAdded;
  }

  get statechange(): Subject<{
    item: QueueItem,
    oldState: State
  }> {
    return this._statechange;
  }

  private queue: QueueItem[] = [];

  private _statechange = new Subject<{
    item: QueueItem,
    oldState: State
  }>();
  private _itemProcessed = new Subject<QueueItem>();
  private _itemAdded = new Subject<QueueItem>();
  private _itemRemoved = new Subject<number>();

  public process: (queueItem: QueueItem) => Promise<(Task | TaskDirectory)[]> = () => {
    return new Promise<(Task | TaskDirectory)[]>(
      (resolve, reject) => {
        resolve(null);
      }
    );
  };

  constructor() {
    this._itemAdded.subscribe(this.onItemAdded);
  }

  public changeState(item: QueueItem, state: State) {
    const oldState = item.state;
    item.state = state;

    this.statechange.next({
      item: item,
      oldState: oldState
    });
  }

  private onItemAdded = (newItem: QueueItem) => {

    this.changeState(newItem, State.PROCESSING);
    this.process(newItem).then((result) => {
        if (!isNullOrUndefined(result)) {
          newItem.results = result;
          this.changeState(newItem, State.FINISHED);
          this._itemProcessed.next(newItem);
          this.removeFromQueue(newItem.id);
        }
      }
    ).catch((err) => {
      console.error(err);
    })
    ;
  };

  public addToQueue(file: (FileInfo | DirectoryInfo)) {
    const queueItem = new QueueItem(file);

    this.queue.push(queueItem);
    this._itemAdded.next(queueItem);
  }

  public removeFromQueue(id: number): boolean {
    const index = this.queue.findIndex((a) => {
      return a.id === id;
    });

    if (index > -1) {
      this.queue.splice(index, 1);
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
}