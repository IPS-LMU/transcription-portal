import { HttpClient } from '@angular/common/http';
import { Observable, ReplaySubject, Subject, Subscription } from 'rxjs';
import { TaskEntry } from './task-entry';
import { IAccessCode, Operation } from '../operations/operation';
import { OHCommand, ProviderLanguage } from '../oh-config';
import { AudioInfo, DirectoryInfo, FileInfo } from '@octra/web-media';
import { SubscriptionManager } from '@octra/utilities';
import { ServiceProvider } from '@octra/ngx-components';

export enum TaskState {
  INACTIVE = 'INACTIVE',
  QUEUED = 'QUEUED',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  SKIPPED = 'SKIPPED',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR',
}

export class Task {
  public fileschange: Subject<void> = new Subject<void>();
  public mouseover = false;
  private opstatesubj = new ReplaySubject<{
    opID: number;
    oldState: TaskState | undefined;
    newState: TaskState;
  }>();
  public opstatechange: Observable<{
    opID: number;
    oldState: TaskState | undefined;
    newState: TaskState;
  }> = this.opstatesubj.asObservable();
  private statesubj = new ReplaySubject<{
    oldState: TaskState | undefined;
    newState: TaskState;
  }>();
  public statechange: Observable<{
    oldState: TaskState | undefined;
    newState: TaskState;
  }> = this.statesubj.asObservable();
  private subscrmanager = new SubscriptionManager<Subscription>();
  private stopRequested = false;
  private readonly _id: number;

  constructor(files: FileInfo[], operations: Operation[], directory?: TaskDirectory, id?: number) {
    if ((id === null || id === undefined)) {
      this._id = ++TaskEntry.counter;
    } else {
      this._id = id;
    }
    this._files = files;
    this.sortFilesArray();

    // clone operations param
    for (const operation of operations) {
      this.operations.push(operation.clone(this));
    }

    this.listenToOperationChanges();

    this.changeState(TaskState.PENDING);
    this._directory = directory;
  }

  get id(): number {
    return this._id;
  }

  private _language?: string;

  get language(): string | undefined {
    return this._language;
  }

  set language(value: string | undefined) {
    this._language = value;
  }

  private _provider?: string;

  get provider(): string | undefined {
    return this._provider;
  }

  set provider(value: string | undefined) {
    this._provider = value;
  }

  private _files: FileInfo[];

  get files(): FileInfo[] {
    return this._files;
  }

  set files(value: FileInfo[]) {
    this._files = value;
    this.fileschange.next();
  }

  // operations that have to be done
  private _operations: Operation[] = [];

  get operations(): Operation[] {
    return this._operations;
  }

  private _directory: TaskDirectory | undefined;

  get directory(): TaskDirectory | undefined {
    return this._directory;
  }

  set directory(value: TaskDirectory | undefined) {
    this._directory = value;
  }

  private _type: 'task' | 'folder' = 'task';

  get type(): 'task' | 'folder' {
    return this._type;
  }

  private _state: TaskState = TaskState.PENDING;

  get state(): TaskState {
    return this._state;
  }

  public static fromAny(taskObj: any, commands: OHCommand[], defaultOperations: Operation[]): Task {
    const operations: Operation[] = [];

    const task = new Task([], operations, undefined, taskObj.id);
    task.language = taskObj.language;
    task._provider = (taskObj.operations[1].webService && taskObj.operations[1].webService !== '')
      ? taskObj.operations[1].webService : taskObj.asr;

    if (taskObj.state !== TaskState.PROCESSING) {
      task.changeState(taskObj.state);
    } else {
      task.changeState(TaskState.READY);
    }

    for (const file of taskObj.files) {
      let info;

      if (file.fullname.indexOf('wav') > 0) {
        info = new AudioInfo(file.fullname, file.type, file.size, file.sampleRate, file.duration, file.channels, file.bitsPerSecond);
        info.attributes = file.attributes;
        info.hash = file.hash;
      } else {
        info = FileInfo.fromAny(file);
      }
      task.files.push(info);
    }

    for (const operationObj of taskObj.operations) {
      for (let j = 0; j < defaultOperations.length; j++) {
        const op = defaultOperations[j];
        if (op.name === operationObj.name) {
          const operation = op.fromAny(operationObj, commands[j].calls, task);
          if (operation.state === TaskState.UPLOADING) {
            operation.changeState(TaskState.PENDING);
          } else {
            if (operation.state === TaskState.PROCESSING) {
              if (operation.name === 'OCTRA' || operation.name === 'Emu WebApp') {
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
    const isSomethingPending = task.operations.findIndex(a => a.state === TaskState.PENDING) > -1;
    const isSomethingReady = task.operations.findIndex(a => a.state === TaskState.READY) > -1;

    if (task.state !== TaskState.QUEUED) {
      if (isSomethingPending) {
        task.changeState(TaskState.PENDING);
      } else if (isSomethingReady) {
        task.changeState(TaskState.READY);
      }
    }

    task.listenToOperationChanges();

    return task;
  }

  public start(asrService: ServiceProvider, languageObj: ProviderLanguage, httpclient: HttpClient, accessCodes: IAccessCode[]) {
    if (this.state !== TaskState.FINISHED) {
      this.startNextOperation(asrService, languageObj, httpclient, accessCodes);
    }
  }

  public restart(asrService: ServiceProvider, languageObj: ProviderLanguage, http: HttpClient, accessCodes: IAccessCode[]) {
    this.changeState(TaskState.PROCESSING);
    this.listenToOperationChanges();
    this.start(asrService, languageObj, http, accessCodes);
  }

  public restartFailedOperation(asrService: ServiceProvider, languageObject: ProviderLanguage, httpclient: HttpClient, accessCodes: IAccessCode[]) {
    for (const operation of this.operations) {
      if (operation.state === TaskState.ERROR) {
        // restart failed operation
        operation.changeState(TaskState.READY);
        this.changeState(TaskState.PENDING);
        this.restart(asrService, languageObject, httpclient, accessCodes);
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
        asr: this.provider,
        files: [],
        operations: []
      };

      // read file data
      const filePromises: Promise<unknown>[] = [];
      for (const file of this.files) {
        filePromises.push(file.toAny());
      }

      Promise.all(filePromises).then((values) => {
        for (let i = 0; i < values.length; i++) {
          const file = this.files[i];

          const fileObj: any = values[i];

          // TODO check this
          if (file instanceof AudioInfo) {
            const audioFile = file as AudioInfo;

            fileObj.sampleRate = audioFile.sampleRate;
            fileObj.bitsPerSecond = audioFile.bitrate;
            fileObj.channels = audioFile.channels;
            fileObj.duration = audioFile.duration.samples;
          }
          fileObj.attributes = file.attributes;

          result.files.push(fileObj as never);
        }

        result.folderPath = ((this._directory === null || this._directory === undefined)) ? '' : this._directory.path;

        // read operation data
        const promises: Promise<any>[] = [];
        for (const operation of this.operations) {
          promises.push(operation.toAny());
        }

        if (promises.length > 0) {
          Promise.all(promises).then((values2) => {
            result.operations = values2 as never[];
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

  protected listenToOperationChanges() {
    for (const operation of this._operations) {
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

  private startNextOperation(asrService: ServiceProvider, languageObj: ProviderLanguage, httpclient: HttpClient, accessCodes: IAccessCode[]) {
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
          if ((operation.name === 'OCTRA' || operation.name === 'Emu WebApp') && operation.state === TaskState.READY) {
            this.changeState(TaskState.READY);
          } else {
            this.changeState(TaskState.PROCESSING);
          }
          const subscription = this.operations[nextoperation].statechange.subscribe(
            (event) => {
              if (event.newState === TaskState.FINISHED) {
                subscription.unsubscribe();
                this.startNextOperation(asrService, languageObj, httpclient, accessCodes);
              } else {
                if (event.newState === TaskState.READY) {
                  this.changeState(TaskState.READY);
                }
              }
            },
            (error) => {
              console.error(error);
            });

          let files;
          if (this.files.length > 0 && !(this.files[0].file === null || this.files[0].file === undefined)) {
            files = this.files;
          } else {
            files = this.operations[0].results;
          }

          this.operations[nextoperation].start(asrService, languageObj, files, this.operations, httpclient, "");
        }
      }
    } else {
      this.changeState(TaskState.PENDING);
    }
  }
}

export class TaskDirectory {
  private readonly _size?: number;
  private readonly _path: string;
  private readonly _id: number;
  private readonly _foldername: string;

  public constructor(path: string, size?: number, id?: number) {
    this._size = size;
    this._path = path;
    if (!(id === null || id === undefined)) {
      this._id = id;
    } else {
      this._id = ++TaskEntry.counter;
    }
    this._foldername = DirectoryInfo.extractFolderName(path)!;
  }

  get foldername(): string {
    return this._foldername;
  }

  get id(): number {
    return this._id;
  }

  get size(): number | undefined {
    return this._size;
  }

  get path(): string {
    return this._path;
  }

  private _entries: (Task | TaskDirectory)[] = [];

  get entries(): (Task | TaskDirectory)[] {
    return this._entries;
  }

  private _type: 'task' | 'folder' = 'folder';

  get type(): 'task' | 'folder' {
    return this._type;
  }

  public static fromFolderObject(folder: never): Promise<TaskDirectory> {
    return new Promise<TaskDirectory>((resolve, reject) => {
      if (folder) {
        TaskDirectory.traverseFileTree(folder, '').then((result) => {
          if (!(result === null || result === undefined) && result[0] instanceof TaskDirectory) {
            resolve(result[0] as TaskDirectory);
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

  public static fromAny(dirObj: any, commands: OHCommand[], defaultOperations: Operation[]): TaskDirectory {
    const result = new TaskDirectory(dirObj.path, undefined, dirObj.id);

    for (const entry of dirObj.entries) {
      result.addEntries([Task.fromAny(entry, commands, defaultOperations)]);
    }

    return result;
  }

  private static traverseFileTree(item: any, path: string): Promise<(Task | TaskDirectory)[]> {
    // console.log(`search path: ${path}`);
    return new Promise<(Task | TaskDirectory)[]>((resolve, reject) => {
      path = path || '';
      if (item.isFile) {
        // console.log(`isFile ${item.fullPath}`);
        // Get file
        item.file((file: any) => {
          const fileInfo = new FileInfo(file.fullName, file.type, 0, file);
          const task = new Task([fileInfo], []);
          // console.log("get file");
          resolve([task]);
        });
      } else if (item.isDirectory) {
        // Get folder contents
        // console.log(`is dir ${item.fullPath}`);

        const dirReader = item.createReader();
        dirReader.readEntries((entries: FileSystemEntry[]) => {
          const promises: Promise<(Task | TaskDirectory)[]>[] = [];
          for (const entry of entries) {
            promises.push(this.traverseFileTree(entry, path + item.name + '/'));
          }
          Promise.all(promises).then((values: (Task | TaskDirectory)[][]) => {
            const dir = new TaskDirectory(path + item.name + '/');
            const result: (Task | TaskDirectory)[] = [];

            for (const value of values) {
              for (const val of value) {
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

  public addEntries(entries: (Task | TaskDirectory)[]) {
    for (const entry of entries) {
      if (entry instanceof Task) {
        entry.directory = this;
      }
      this._entries.push(entry);
    }
  }

  public getAllTasks(): Task[] {
    let result: Task[] = [];

    for (const elem of this._entries) {
      if (elem instanceof Task) {
        result.push(elem);
      } else {
        result = result.concat((elem as TaskDirectory).getAllTasks());
      }
    }

    return result;
  }

  public removeTask(task: Task) {
    const taskIndex = this.entries.findIndex((a: Task | TaskDirectory) => {
      return a instanceof Task && (a as Task).id === task.id;
    });
    this._entries.splice(taskIndex, 1);
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
      for (const entry of this.entries) {
        promises.push(entry.toAny());
      }

      Promise.all(promises).then((values) => {
        result.entries = values as never[];
        resolve(result);
      }).catch((error) => {
        reject(error);
      });
    });
  }
}
