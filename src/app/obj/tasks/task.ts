import {HttpClient} from '@angular/common/http';
import {Observable, ReplaySubject, Subject} from 'rxjs';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {FileInfo} from '../fileInfo';
import {AudioInfo} from '../audio';
import {TaskEntry} from './task-entry';
import {Operation} from '../operations/operation';
import {OHCommand, OHLanguageObject} from '../oh-config';
import {DirectoryInfo} from '../directoryInfo';
import {isset} from '../../shared/Functions';

export enum TaskState {
  INACTIVE = 'INACTIVE',
  QUEUED = 'QUEUED',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  SKIPPED = 'SKIPPED',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR'
}

export class Task {
  set asr(value: any) {
    this._asr = value;
  }

  get asr(): any {
    return this._asr;
  }

  set files(value: FileInfo[]) {
    this._files = value;
    this.fileschange.next();
  }

  set directory(value: TaskDirectory) {
    this._directory = value;
  }

  get type(): string {
    return this._type;
  }

  get directory(): TaskDirectory {
    return this._directory;
  }

  get language(): any {
    return this._language;
  }

  set language(value: any) {
    this._language = value;
  }

  get operations(): Operation[] {
    return this._operations;
  }

  get files(): FileInfo[] {
    return this._files;
  }

  constructor(files: FileInfo[], operations: Operation[], directory?: TaskDirectory, id?: number) {
    if ((id === null || id === undefined)) {
      this._id = ++TaskEntry.counter;
    } else {
      this._id = id;
    }
    this._files = files;
    this.sortFilesArray();

    // clone operations param
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i].clone(this);

      this.operations.push(operation);
    }

    this.listenToOperationChanges();

    this.changeState(TaskState.PENDING);
    this._directory = directory;
  }

  get id(): number {
    return this._id;
  }

  get state(): TaskState {
    return this._state;
  }

  private opstatesubj: Subject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = new ReplaySubject<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }>();
  public opstatechange: Observable<{
    opID: number;
    oldState: TaskState;
    newState: TaskState;
  }> = this.opstatesubj.asObservable();

  private statesubj: Subject<{
    oldState: TaskState;
    newState: TaskState;
  }> = new ReplaySubject<{
    oldState: TaskState;
    newState: TaskState;
  }>();
  public statechange: Observable<{
    oldState: TaskState;
    newState: TaskState;
  }> = this.statesubj.asObservable();

  public fileschange: Subject<void> = new Subject<void>();

  private _language = null;
  private _asr = null;
  private _files: FileInfo[];
  // operations that have to be done
  private _operations: Operation[] = [];
  private subscrmanager: SubscriptionManager = new SubscriptionManager();
  private _directory: TaskDirectory;
  private _type = 'task';

  private stopRequested = false;

  public mouseover = false;

  private readonly _id: number;

  private _state: TaskState;

  public static fromAny(taskObj: any, commands: OHCommand[], defaultOperations: Operation[]): Task {
    const operations = [];

    const task = new Task([], operations, null, taskObj.id);
    task.language = taskObj.language;
    task._asr = (isset(taskObj.operations[1].webService)) ? taskObj.operations[1].webService : taskObj.asr;

    if (taskObj.state !== TaskState.PROCESSING) {
      task.changeState(taskObj.state);
    } else {
      task.changeState(TaskState.READY);
    }

    for (let i = 0; i < taskObj.files.length; i++) {
      const file = taskObj.files[i];
      let info;

      if (file.fullname.indexOf('wav') > 0) {
        info = new AudioInfo(file.fullname, file.type, file.size, file.sampleRate, file.duration, file.channels, file.bitsPerSecond);
        info.attributes = file.attributes;
      } else {
        info = FileInfo.fromAny(file);
      }
      task.files.push(info);
    }

    for (let i = 0; i < taskObj.operations.length; i++) {
      const operationObj = taskObj.operations[i];
      for (let j = 0; j < defaultOperations.length; j++) {
        const op = defaultOperations[j];
        if (op.name === operationObj.name) {
          const operation = op.fromAny(operationObj, commands[j].calls, task);
          if (operation.state === TaskState.UPLOADING) {
            operation.changeState(TaskState.PENDING);
          } else {
            if (operation.state === TaskState.PROCESSING) {
              if (operation.name === 'OCTRA') {
                operation.changeState(TaskState.READY);
              } else {
                operation.changeState(TaskState.PENDING);
              }
            }
          }
          task.operations.push(operation);
          break;
        }
      }
    }

    task.listenToOperationChanges();

    return task;
  }

  protected listenToOperationChanges() {
    for (let i = 0; i < this._operations.length; i++) {
      const operation = this._operations[i];

      const subscription = operation.statechange.subscribe(
        (event) => {
          if (event.newState === TaskState.ERROR) {
            this.changeState(TaskState.ERROR);
          }

          this.opstatesubj.next({
            opID: operation.id,
            oldState: event.oldState,
            newState: event.newState
          });

          if (event.newState === TaskState.FINISHED) {
            if ((operation.nextOperation === null || operation.nextOperation === undefined)) {
              this.changeState(TaskState.FINISHED);
            }
            subscription.unsubscribe();
          }
        }
      );
    }
  }

  private sortFilesArray() {
    if (!(this._files === null || this._files === undefined)) {
      this._files = this._files.sort((a, b) => {
        if (a.extension === '.wav') {
          return -1;
        }
        return 1;
      });
    }
  }

  public start(languageObject: OHLanguageObject, httpclient: HttpClient, test = false) {
    if (this.state !== TaskState.FINISHED) {
      this.startNextOperation(languageObject, httpclient, test);
    }
  }

  private startNextOperation(languageObject: OHLanguageObject, httpclient: HttpClient, test = false) {
    if (!this.stopRequested) {
      let nextoperation = -1;

      for (let i = 0; i < this.operations.length; i++) {
        const operation = this.operations[i];
        if (!operation.enabled && operation.state !== TaskState.SKIPPED) {
          operation.changeState(TaskState.SKIPPED);
        }
        if (operation.enabled && this.operations[i].state !== TaskState.FINISHED && this.operations[i].state !== TaskState.SKIPPED) {
          nextoperation = i;
          break;
        }
      }

      if (nextoperation === -1) {
        // all finished
        this.changeState(TaskState.FINISHED);
      } else {
        const operation = this.operations[nextoperation];
        if (operation.state !== TaskState.FINISHED) {
          if (operation.name === 'OCTRA' && operation.state === TaskState.READY) {
            this.changeState(TaskState.READY);
          } else {
            this.changeState(TaskState.PROCESSING);
          }
          const subscription = this.operations[nextoperation].statechange.subscribe(
            (event) => {
              if (event.newState === TaskState.FINISHED) {
                subscription.unsubscribe();
                this.startNextOperation(languageObject, httpclient);
              } else {
                if (event.newState === TaskState.READY) {
                  this.changeState(TaskState.READY);
                }
              }
            },
            (error) => {
              console.error(error);
            },
            () => {
            });

          let files;
          if (this.files.length > 0 && !(this.files[0].file === null || this.files[0].file === undefined)) {
            files = this.files;
          } else {
            files = this.operations[0].results;
          }

          this.operations[nextoperation].start(languageObject, files, this.operations, httpclient);
        }
      }
    } else {
      this.changeState(TaskState.PENDING);
    }
  }

  public restart(languageObject: OHLanguageObject, http: HttpClient) {
    this.changeState(TaskState.PROCESSING);
    this.listenToOperationChanges();
    this.start(languageObject, http, true);
  }

  public restartFailedOperation(languageObject: OHLanguageObject, httpclient) {
    for (let i = 0; i < this.operations.length; i++) {
      const operation = this.operations[i];

      if (operation.state === TaskState.ERROR) {
        // restart failed operation
        operation.changeState(TaskState.READY);
        this.changeState(TaskState.PENDING);
        this.restart(languageObject, httpclient);
        break;
      }
    }
  }

  public changeState(state: TaskState) {
    const oldstate = this._state;
    this._state = state;

    if (oldstate !== state) {
      this.statesubj.next({
        oldState: oldstate,
        newState: state
      });
    }
  }

  public getOperationByID(id: number) {
    return this.operations.find((a) => {
      return (a.id === id);
    });
  }

  public addFile(file: FileInfo) {
    if (this._files.findIndex((a) => {
      return a.fullname === file.fullname;
    }) < 0) {
      this._files.push(file);
    }
    this._files = this._files.sort((a, b) => {
      if (a.extension === '.wav') {
        return -1;
      } else {
        return 1;
      }
    });
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  public setFileObj(index: number, fileObj: FileInfo) {
    if (index < this.files.length) {
      this.files[index] = fileObj;
      this.fileschange.next();
    }
  }

  public toAny(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const result = {
        id: this.id,
        type: 'task',
        state: this.state,
        folderPath: '',
        language: this.language,
        asr: this.asr,
        files: [],
        operations: []
      };

      // read file data
      const filePromises: Promise<any>[] = [];
      for (let i = 0; i < this.files.length; i++) {
        const file = this.files[i];

        filePromises.push(file.toAny());
      }

      Promise.all(filePromises).then((values) => {
        for (let i = 0; i < values.length; i++) {
          const file = this.files[i];

          const fileObj = values[i];

          if (file instanceof AudioInfo) {
            const audioFile = <AudioInfo>file;

            fileObj['sampleRate'] = audioFile.samplerate;
            fileObj['bitsPerSecond'] = audioFile.bitrate;
            fileObj['channels'] = audioFile.channels;
            fileObj['duration'] = audioFile.duration.samples;
          }
          fileObj['attributes'] = file.attributes;

          result.files.push(fileObj);
        }

        result.folderPath = ((this._directory === null || this._directory === undefined)) ? '' : this._directory.path;

        // read operation data
        const promises: Promise<any>[] = [];
        for (let i = 0; i < this.operations.length; i++) {
          promises.push(this.operations[i].toAny());
        }

        if (promises.length > 0) {
          Promise.all(promises).then((values2) => {
            result.operations = values2;
            resolve(result);
          }).catch((error) => {
            console.error('not arrived');
            reject(error);
          });
        } else {
          resolve(result);
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  public stopTask() {
    this.stopRequested = true;
  }

  public resumeTask() {
    this.stopRequested = false;
  }
}

export class TaskDirectory {
  get foldername(): string {
    return this._foldername;
  }

  get type(): string {
    return this._type;
  }

  get id(): number {
    return this._id;
  }

  get entries(): (Task | TaskDirectory)[] {
    return this._entries;
  }

  get size(): number {
    return this._size;
  }

  get path(): string {
    return this._path;
  }

  public constructor(path: string, size?: number, id?: number) {
    this._size = size;
    this._path = path;
    if (!(id === null || id === undefined)) {
      this._id = id;
    } else {
      this._id = ++TaskEntry.counter;
    }
    this._foldername = DirectoryInfo.extractFolderName(path);
  }

  private _entries: (Task | TaskDirectory)[] = [];
  private readonly _size: number;
  private readonly _path: string;
  private readonly _id: number;
  private readonly _foldername: string;
  private _type = 'folder';

  public static fromFolderObject(folder: any): Promise<TaskDirectory> {
    return new Promise<TaskDirectory>((resolve, reject) => {
      if (folder) {
        TaskDirectory.traverseFileTree(folder, '').then((result) => {
          if (!(result === null || result === undefined) && result[0] instanceof TaskDirectory) {
            resolve(<TaskDirectory>result[0]);
          } else {
            reject('could not parse directory');
          }
        }).catch(error => {
          reject(error);
        });
      } else {
        reject('folder not given.');
      }
    });
  }

  private static traverseFileTree(item, path): Promise<(Task | TaskDirectory)[]> {
    // console.log(`search path: ${path}`);
    return new Promise<(Task | TaskDirectory)[]>((resolve, reject) => {
      path = path || '';
      if (item.isFile) {
        // console.log(`isFile ${item.fullPath}`);
        // Get file
        item.file((file) => {
          const fileInfo = new FileInfo(file.fullName, file.type, 0, file);
          const task = new Task([fileInfo], []);
          // console.log("get file");
          resolve([task]);
        });
      } else if (item.isDirectory) {
        // Get folder contents
        // console.log(`is dir ${item.fullPath}`);

        const dirReader = item.createReader();
        dirReader.readEntries((entries) => {
          const promises: Promise<(Task | TaskDirectory)[]>[] = [];
          for (let i = 0; i < entries.length; i++) {
            promises.push(this.traverseFileTree(entries[i], path + item.name + '/'));
          }
          Promise.all(promises).then((values: (Task | TaskDirectory)[][]) => {
            const dir = new TaskDirectory(path + item.name + '/');
            const result = [];

            for (let i = 0; i < values.length; i++) {
              const value = values[i];

              for (let j = 0; j < value.length; j++) {
                const val = value[j];

                result.push(val);
              }
            }

            // console.log(result);
            dir.addEntries(result);
            resolve([dir]);
          });
        });
      }
    });
  }

  public static fromAny(dirObj: any, commands: OHCommand[], defaultOperations: Operation[]): TaskDirectory {
    const result = new TaskDirectory(dirObj.path, undefined, dirObj.id);

    for (let i = 0; i < dirObj.entries.length; i++) {
      const entry = dirObj.entries[i];
      result.addEntries([Task.fromAny(entry, commands, defaultOperations)]);
    }

    return result;
  }

  public addEntries(entries: (Task | TaskDirectory)[]) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry instanceof Task) {
        entry.directory = this;
      }
      this._entries.push(entry);
    }
  }

  public getAllTasks(): Task[] {
    let result: Task[] = [];

    for (let i = 0; i < this._entries.length; i++) {
      const elem = this._entries[i];

      if (elem instanceof Task) {
        result.push(elem);
      } else {
        result = result.concat((<TaskDirectory>elem).getAllTasks());
      }
    }

    return result;
  }

  public removeTask(task: Task) {
    const task_index = this.entries.findIndex((a) => {
      if (a instanceof Task && (<Task>a).id === task.id) {
        return true;
      }
    });
    this._entries.splice(task_index, 1);
  }

  public toAny(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const result = {
        id: this.id,
        type: 'folder',
        path: this.path,
        entries: []
      };

      const promises: Promise<any>[] = [];
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i];
        promises.push(entry.toAny());
      }

      Promise.all(promises).then((values) => {
        result.entries = values;
        resolve(result);
      }).catch((error) => {
        reject(error);
      });
    });
  }
}
