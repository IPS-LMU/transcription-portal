import { HttpClient } from '@angular/common/http';
import { SubscriptionManager } from '@octra/utilities';
import { AudioInfo, DirectoryInfo, FileInfo, FileInfoSerialized } from '@octra/web-media';
import { Observable, ReplaySubject, Subject, Subscription } from 'rxjs';
import { AudioFileInfoSerialized, IDBTaskItem } from '../../indexedDB';
import { OHCommand } from '../oh-config';
import { ASROperation } from '../operations/asr-operation';
import { IAccessCode, IOperation, Operation, OperationOptions } from '../operations/operation';
import { TaskEntry } from './task-entry';

export enum TaskStatus {
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
  public readonly operationChanges$ = new ReplaySubject<Operation>();
  private statesubj = new ReplaySubject<{
    oldState: TaskStatus | undefined;
    newState: TaskStatus;
  }>();
  public statechange: Observable<{
    oldState: TaskStatus | undefined;
    newState: TaskStatus;
  }> = this.statesubj.asObservable();
  private subscrmanager = new SubscriptionManager<Subscription>();
  private stopRequested = false;
  private readonly _id: number;

  get asrOperation(): ASROperation {
    return this._operations[1] as ASROperation;
  }

  constructor(files: FileInfo[], operations: Operation[], directory?: TaskDirectory, id?: number) {
    if (id === null || id === undefined) {
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

    this.changeState(TaskStatus.PENDING);
    this._directory = directory;
  }

  get id(): number {
    return this._id;
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

  private _status: TaskStatus = TaskStatus.PENDING;

  get status(): TaskStatus {
    return this._status;
  }

  setOptions(options: OperationOptions) {
    // set service provider for upload operation
    for (const operation of this._operations) {
      operation.overwriteOptions(options);
    }
  }

  public static fromAny(taskObj: IDBTaskItem, commands: OHCommand[], defaultOperations: Operation[]): Task {
    const operations: Operation[] = [];
    const task = new Task([], operations, undefined, taskObj.id);

    if (taskObj.state !== TaskStatus.PROCESSING) {
      task.changeState(taskObj.state);
    } else {
      task.changeState(TaskStatus.READY);
    }

    for (const file of taskObj.files) {
      let info;

      if (file.fullname.indexOf('wav') > 0) {
        info = new AudioInfo(
          file.fullname,
          file.type,
          file.size,
          (file as AudioFileInfoSerialized).sampleRate,
          (file as AudioFileInfoSerialized).duration,
          (file as AudioFileInfoSerialized).channels,
          (file as AudioFileInfoSerialized).bitsPerSecond,
        );
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
          const operation = op.fromAny(operationObj, commands[j].calls, task, taskObj);
          if (operation.state === TaskStatus.UPLOADING) {
            operation.changeState(TaskStatus.PENDING);
          } else {
            if (operation.state === TaskStatus.PROCESSING) {
              if (operation.name === 'OCTRA' || operation.name === 'Emu WebApp') {
                operation.changeState(TaskStatus.READY);
              } else {
                operation.changeState(TaskStatus.PENDING);
              }
            }
          }
          task.operations.push(operation);
          break;
        }
      }
    }
    const isSomethingPending = task.operations.findIndex((a) => a.state === TaskStatus.PENDING) > -1;
    const isSomethingReady = task.operations.findIndex((a) => a.state === TaskStatus.READY) > -1;

    if (task.status !== TaskStatus.QUEUED) {
      if (isSomethingPending) {
        task.changeState(TaskStatus.PENDING);
      } else if (isSomethingReady) {
        task.changeState(TaskStatus.READY);
      }
    }

    task.listenToOperationChanges();

    return task;
  }

  public start(httpclient: HttpClient, accessCodes: IAccessCode[]) {
    if (this.status !== TaskStatus.FINISHED) {
      this.startNextOperation(httpclient, accessCodes);
    }
  }

  public restart(http: HttpClient, accessCodes: IAccessCode[]) {
    this.changeState(TaskStatus.PROCESSING);
    this.listenToOperationChanges();
    this.start(http, accessCodes);
  }

  public restartFailedOperation(httpclient: HttpClient, accessCodes: IAccessCode[]) {
    for (const operation of this.operations) {
      if (operation.state === TaskStatus.ERROR) {
        // restart failed operation
        operation.changeState(TaskStatus.READY);
        this.changeState(TaskStatus.PENDING);
        this.restart(httpclient, accessCodes);
        break;
      }
    }
  }

  public changeState(status: TaskStatus) {
    const oldstate = this._status;
    this._status = status;

    if (oldstate !== status) {
      this.statesubj.next({
        oldState: oldstate,
        newState: status,
      });
    }
  }

  public getOperationByID(id: number) {
    return this.operations.find((a) => {
      return a.id === id;
    });
  }

  public addFile(file: FileInfo) {
    if (
      this._files.findIndex((a) => {
        return a.fullname === file.fullname;
      }) < 0
    ) {
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
    for (const operation of this.operations) {
      operation.destroy();
    }
  }

  public setFileObj(index: number, fileObj: FileInfo) {
    if (index < this.files.length) {
      this.files[index] = fileObj;
      this.fileschange.next();
    }
  }

  public toAny(): Promise<IDBTaskItem> {
    return new Promise<IDBTaskItem>((resolve, reject) => {
      const result: IDBTaskItem = {
        id: this.id,
        type: 'task',
        state: this.status,
        folderPath: '',
        files: [],
        operations: [],
      };

      // read file data
      const filePromises: Promise<FileInfoSerialized>[] = [];
      for (const file of this.files) {
        filePromises.push(file.toAny());
      }

      Promise.all(filePromises)
        .then((serializedFiles) => {
          for (let i = 0; i < serializedFiles.length; i++) {
            const file = this.files[i];
            const serializedFile: FileInfoSerialized | AudioFileInfoSerialized = serializedFiles[i];

            if (file instanceof AudioInfo) {
              const audioFile = file as AudioInfo;
              (serializedFile as AudioFileInfoSerialized).sampleRate = audioFile.sampleRate;
              (serializedFile as AudioFileInfoSerialized).bitsPerSecond = audioFile.bitrate;
              (serializedFile as AudioFileInfoSerialized).channels = audioFile.channels;
              (serializedFile as AudioFileInfoSerialized).duration = audioFile.duration.samples;
            }
            serializedFile.attributes = file.attributes;

            result.files.push(serializedFile as never);
          }

          result.folderPath = this._directory === null || this._directory === undefined ? '' : this._directory.path;

          // read operation data
          const operationPromises: Promise<IOperation>[] = [];
          for (const operation of this.operations) {
            operationPromises.push(operation.toAny());
          }

          if (operationPromises.length > 0) {
            Promise.all(operationPromises)
              .then((serializedOperations) => {
                result.operations = serializedOperations;
                resolve(result);
              })
              .catch((error) => {
                console.error('not arrived');
                reject(error);
              });
          } else {
            resolve(result);
          }
        })
        .catch((error) => {
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
      const subscriptionID = this.subscrmanager.add(
        operation.changes$.subscribe((event) => {
          if (event.state === TaskStatus.ERROR) {
            this.changeState(TaskStatus.ERROR);
          }

          this.operationChanges$.next(event);

          if (event.isFinished) {
            if (operation.nextOperation) {
              this.changeState(TaskStatus.FINISHED);
            }
            this.subscrmanager.removeById(subscriptionID);
          }
        }),
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

  private startNextOperation(httpclient: HttpClient, accessCodes: IAccessCode[]) {
    if (!this.stopRequested) {
      let nextoperation = -1;

      for (let i = 0; i < this.operations.length; i++) {
        const operation = this.operations[i];
        if (!operation.enabled && operation.state !== TaskStatus.SKIPPED) {
          operation.changeState(TaskStatus.SKIPPED);
        }
        if (operation.enabled && this.operations[i].state !== TaskStatus.FINISHED && this.operations[i].state !== TaskStatus.SKIPPED) {
          nextoperation = i;
          break;
        }
      }

      if (nextoperation === -1) {
        // all finished
        this.changeState(TaskStatus.FINISHED);
      } else {
        const operation = this.operations[nextoperation];
        if (operation.state !== TaskStatus.FINISHED) {
          if ((operation.name === 'OCTRA' || operation.name === 'Emu WebApp') && operation.state === TaskStatus.READY) {
            this.changeState(TaskStatus.READY);
          } else {
            this.changeState(TaskStatus.PROCESSING);
          }
          const subscriptionID = this.subscrmanager.add(
            this.operations[nextoperation].changes$.subscribe({
              next: (changedOperation) => {
                if (changedOperation.isFinished) {
                  this.subscrmanager.removeById(subscriptionID);
                  this.startNextOperation(httpclient, accessCodes);
                } else {
                  if (changedOperation.state === TaskStatus.READY) {
                    this.changeState(TaskStatus.READY);
                  }
                }
              },
              error: (error: any) => {
                console.error(error);
              },
            }),
          );

          let files;
          if (this.files.length > 0 && this.files[0].file) {
            files = this.files;
          } else {
            files = this.operations[0].lastRound!.results!;
          }

          if (!['OCTRA', 'Emu WebApp'].includes(this.operations[nextoperation].name)) {
            this.operations[nextoperation].start(files, this.operations, httpclient, '');
          } else {
            this.operations[nextoperation].changeState(TaskStatus.READY);
          }
        }
      }
    } else {
      this.changeState(TaskStatus.PENDING);
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
        TaskDirectory.traverseFileTree(folder, '')
          .then((result) => {
            if (!(result === null || result === undefined) && result[0] instanceof TaskDirectory) {
              resolve(result[0] as TaskDirectory);
            } else {
              reject('could not parse directory');
            }
          })
          .catch((error) => {
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

    if (taskIndex > -1) {
      task.destroy();
      this._entries.splice(taskIndex, 1);
    }
  }

  public toAny(): Promise<ITaskDirectory> {
    return new Promise<ITaskDirectory>((resolve, reject) => {
      const result: ITaskDirectory = {
        id: this.id,
        type: 'folder',
        path: this.path,
        entries: [],
      };

      const promises: Promise<any>[] = [];
      for (const entry of this.entries) {
        promises.push(entry.toAny());
      }

      Promise.all(promises)
        .then((values) => {
          result.entries = values as never[];
          resolve(result);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  public destroy() {
    for (const entry of this.entries) {
      entry.destroy();
    }
  }
}

export interface ITaskDirectory {
  id: number;
  type: 'folder';
  path: string;
  entries: IDBTaskItem[];
}
