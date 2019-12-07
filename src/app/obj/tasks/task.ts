import {HttpClient} from '@angular/common/http';
import {Observable, ReplaySubject, Subject} from 'rxjs';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {FileInfo} from '../fileInfo';
import {AudioInfo} from '../audio';
import {TaskEntry} from './task-entry';
import {IAccessCode, Operation} from '../operations/operation';
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
  public fileschange: Subject<void> = new Subject<void>();
  public mouseover = false;
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
  private subscrmanager: SubscriptionManager = new SubscriptionManager();
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

  private _language = null;

  get language(): any {
    return this._language;
  }

  set language(value: any) {
    this._language = value;
  }

  private _asr = null;

  get asr(): any {
    return this._asr;
  }

  set asr(value: any) {
    this._asr = value;
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

  private _directory: TaskDirectory;

  get directory(): TaskDirectory {
    return this._directory;
  }

  set directory(value: TaskDirectory) {
    this._directory = value;
  }

  private _type = 'task';

  get type(): string {
    return this._type;
  }

  private _state: TaskState;

  get state(): TaskState {
    return this._state;
  }

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

    for (const file of taskObj.files) {
      let info;

      if (file.fullname.indexOf('wav') > 0) {
        info = new AudioInfo(file.fullname, file.type, file.size, file.sampleRate, file.duration, file.channels, file.bitsPerSecond);
        info.attributes = file.attributes;
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

  public start(languageObject: OHLanguageObject, httpclient: HttpClient, accessCodes: IAccessCode[]) {
    if (this.state !== TaskState.FINISHED) {
      this.startNextOperation(languageObject, httpclient, accessCodes);
    }
  }

  public restart(languageObject: OHLanguageObject, http: HttpClient, accessCodes: IAccessCode[]) {
    this.changeState(TaskState.PROCESSING);
    this.listenToOperationChanges();
    this.start(languageObject, http, accessCodes);
  }

  public restartFailedOperation(languageObject: OHLanguageObject, httpclient, accessCodes: IAccessCode[]) {
    for (const operation of this.operations) {
      if (operation.state === TaskState.ERROR) {
        // restart failed operation
        operation.changeState(TaskState.READY);
        this.changeState(TaskState.PENDING);
        this.restart(languageObject, httpclient, accessCodes);
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
      for (const file of this.files) {
        filePromises.push(file.toAny());
      }

      Promise.all(filePromises).then((values) => {
        for (let i = 0; i < values.length; i++) {
          const file = this.files[i];

          const fileObj = values[i];

          if (file instanceof AudioInfo) {
            const audioFile = file as AudioInfo;

            fileObj.sampleRate = audioFile.samplerate;
            fileObj.bitsPerSecond = audioFile.bitrate;
            fileObj.channels = audioFile.channels;
            fileObj.duration = audioFile.duration.samples;
          }
          fileObj.attributes = file.attributes;

          result.files.push(fileObj);
        }

        result.folderPath = ((this._directory === null || this._directory === undefined)) ? '' : this._directory.path;

        // read operation data
        const promises: Promise<any>[] = [];
        for (const operation of this.operations) {
          promises.push(operation.toAny());
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

  private startNextOperation(languageObject: OHLanguageObject, httpclient: HttpClient, accessCodes: IAccessCode[]) {
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
                this.startNextOperation(languageObject, httpclient, accessCodes);
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

          this.operations[nextoperation].start(languageObject, files, this.operations, httpclient,
            this.getAccessCode(languageObject, accessCodes));
        }
      }
    } else {
      this.changeState(TaskState.PENDING);
    }
  }

  private getAccessCode(langObject: OHLanguageObject, accessCodes: IAccessCode[]) {
    const result = accessCodes.find((a) => {
      return a.name === `${langObject.asr}ASR`;
    });
    return (result) ? result.value : '';
  }
}

export class TaskDirectory {
  private readonly _size: number;
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
    this._foldername = DirectoryInfo.extractFolderName(path);
  }

  get foldername(): string {
    return this._foldername;
  }

  get id(): number {
    return this._id;
  }

  get size(): number {
    return this._size;
  }

  get path(): string {
    return this._path;
  }

  private _entries: (Task | TaskDirectory)[] = [];

  get entries(): (Task | TaskDirectory)[] {
    return this._entries;
  }

  private _type = 'folder';

  get type(): string {
    return this._type;
  }

  public static fromFolderObject(folder: any): Promise<TaskDirectory> {
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
          for (const entry of entries) {
            promises.push(this.traverseFileTree(entry, path + item.name + '/'));
          }
          Promise.all(promises).then((values: (Task | TaskDirectory)[][]) => {
            const dir = new TaskDirectory(path + item.name + '/');
            const result = [];

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
    const taskIndex = this.entries.findIndex((a) => {
      if (a instanceof Task && (a as Task).id === task.id) {
        return true;
      }
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
        result.entries = values;
        resolve(result);
      }).catch((error) => {
        reject(error);
      });
    });
  }
}
