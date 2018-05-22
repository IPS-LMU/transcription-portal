import {HttpClient} from '@angular/common/http';
import {EventEmitter, Injectable, OnDestroy} from '@angular/core';
import {isNullOrUndefined} from 'util';
import {NotificationService} from '../../shared/notification.service';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {EntryChangeEvent, Task, TaskDirectory, TaskList, TaskState} from './index';
import {OCTRAOperation} from './octra-operation';
import {UploadOperation} from './upload-operation';
import {G2pMausOperation} from './g2p-maus-operation';
import {FileInfo} from '../fileInfo';
import {DirectoryInfo} from '../directoryInfo';
import {StorageService} from '../../storage.service';
import {Preprocessor, QueueItem} from '../preprocessor';
import {WavFormat} from '../audio/AudioFormats/index';
import {AudioInfo} from '../audio/index';
import {AppInfo} from '../../app.info';
import {TaskEntry} from './task-entry';
import {ASROperation} from './asr-operation';
import {EmuOperation} from './emu-operation';
import {Operation} from './operation';
import * as moment from 'moment';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';

@Injectable()
export class TaskService implements OnDestroy {
  set splitPrompt(value: string) {
    this._splitPrompt = value;
  }

  get splitPrompt(): string {
    return this._splitPrompt;
  }

  get preprocessor(): Preprocessor {
    return this._preprocessor;
  }

  get protocol_array(): any[] {
    return this._protocol_array;
  }

  get warnings_count(): number {
    return this._warnings_count;
  }

  get errors_count(): number {
    return this._errors_count;
  }

  private _taskList: TaskList;

  get taskList(): TaskList {
    return this._taskList;
  }

  private _operations: Operation[] = [];
  public newfiles = false;

  get operations(): Operation[] {
    return this._operations;
  }

  private options = {
    max_running_tasks: 3
  };
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  private _errors_count = 0;
  private _warnings_count = 0;
  private _protocol_array = [];
  private _splitPrompt = 'PENDING';

  public protocolURL: SafeResourceUrl;
  public protocolFileName = '';

  public errorscountchange = new EventEmitter<number>();

  public selectedlanguage = AppInfo.languages[0];
  private state: TaskState = TaskState.READY;

  private _preprocessor: Preprocessor = new Preprocessor();

  constructor(public httpclient: HttpClient, private notification: NotificationService,
              private storage: StorageService, private sanitizer: DomSanitizer) {
    this._taskList = new TaskList();
    this._operations = [
      new UploadOperation('Upload', '<i class="fa fa-upload" aria-hidden="true"></i>'),
      new ASROperation('ASR', '<i class="fa fa-forward" aria-hidden="true"></i>'),
      // new ToolOperation('OCTRA'),
      new OCTRAOperation('OCTRA'),
      new G2pMausOperation('MAUS'),
      new EmuOperation('Emu WebApp')
    ];

    this._preprocessor.process = this.process;

    this.subscrmanager.add(this._preprocessor.itemProcessed.subscribe(
      (item) => {
        console.log(item);
        for (let i = 0; i < item.results.length; i++) {
          const result = item.results[i];
          let foundTask: Task = null;

          if (result instanceof Task) {
            result.changeState(TaskState.QUEUED);

            foundTask = this.taskList.getAllTasks().find((a) => {
              return a.state === TaskState.QUEUED && !isNullOrUndefined(a.files.find((b) => {
                // console.log(`${result.files[0].name} === ${b.name} && ${a.state}`);
                return b.name.includes(result.files[0].name) || result.files[0].name.includes(b.name);
              }));
            });

            if (!isNullOrUndefined(foundTask) && !(foundTask.files[0].extension === '.wav'
              && result.files[0].extension === '.wav')) {
              foundTask.addFile(result.files[0]);
              if (foundTask.files.length > 1) {
                // TODO change if other than transcript files are needed
                foundTask.operations[1].enabled = false;
                foundTask.operations[1].changeState(TaskState.SKIPPED);
                console.log(`MORE THAN 1`);
              }
              this.storage.saveTask(foundTask);
            }
          } else {
            console.log(result);

            for (let j = 0; j < result.entries.length; j++) {
              const entry = <Task> result.entries[j];
              const tasks: Task[] = <Task[]> result.entries.filter((a) => {
                return a instanceof Task;
              });

              // search for grouped files in this new directory
              for (let v = j + 1; v < tasks.length; v++) {
                const task = tasks[v];

                if (!isNullOrUndefined(task.files.find((b) => {
                  // console.log(`${result.files[0].name} === ${b.name} && ${a.state}`);
                  return b.name.includes(entry.files[0].name) || entry.files[0].name.includes(b.name);
                }))) {
                  if (!(task.files[0].extension === '.wav'
                    && entry.files[0].extension === '.wav')) {

                    entry.addFile(task.files[0]);

                    result.entries.splice(v, 1);
                    tasks.splice(v, 1);
                    v--;

                    // TODO change if other than transcript files are needed
                    entry.operations[1].enabled = false;
                    entry.operations[1].changeState(TaskState.SKIPPED);
                  }
                }
              }

              console.log(entry);

              foundTask = this.taskList.getAllTasks().find((a) => {
                return a.state === TaskState.QUEUED && !isNullOrUndefined(a.files.find((b) => {
                  // console.log(`${result.files[0].name} === ${b.name} && ${a.state}`);
                  return b.name.includes(entry.files[0].name) || entry.files[0].name.includes(b.name);
                }));
              });

              if (!isNullOrUndefined(foundTask) && !(foundTask.files[0].extension === '.wav'
                && entry.files[0].extension === '.wav')) {
                console.log(entry.files);
                foundTask.files[0] = entry.files[0];
                foundTask.files[1] = entry.files[1];

                if (foundTask.files.length > 1) {
                  // TODO change if other than transcript files are needed
                  foundTask.operations[1].enabled = false;
                  foundTask.operations[1].changeState(TaskState.SKIPPED);
                }
              } else {
              }

              entry.changeState(TaskState.QUEUED);
            }
          }

          if (isNullOrUndefined(foundTask)) {
            this.addEntry(result, true);
          }
        }

        if (this.preprocessor.queue.length === 0) {
          console.log(`all PROCESSED COMPLETELY`);
          // check remaining unchecked files
          this.checkFiles();
        }
      }
    ));

    this.subscrmanager.add(this.storage.allloaded.subscribe((results) => {
      const IDBtasks = results[0];

      if (!isNullOrUndefined(IDBtasks)) {
        this.newfiles = IDBtasks.length > 0;

        for (let i = 0; i < IDBtasks.length; i++) {
          const taskObj = IDBtasks[i];
          if (taskObj.type === 'task') {
            const task = Task.fromAny(taskObj, this.operations);

            for (let j = 0; j < task.operations.length; j++) {
              const operation = task.operations[j];

              for (let k = 0; k < operation.results.length; k++) {
                const opResult = operation.results[k];

                if (!isNullOrUndefined(opResult.url)) {
                  this.existsFile(opResult.url).then(() => {
                    opResult.online = true;

                    if (isNullOrUndefined(opResult.file) && opResult.extension.indexOf('wav') < 0) {
                      opResult.updateContentFromURL(this.httpclient).then(() => {
                        // TODO minimize task savings
                        this.storage.saveTask(task);
                      }).catch((error) => {
                        console.error(error);
                      });
                    }
                  }).catch(() => {
                    opResult.online = false;
                  });
                }
              }
            }
            this._taskList.addEntry(task);
          } else {
            const taskDir = TaskDirectory.fromAny(taskObj, this.operations);

            for (let l = 0; l < taskDir.entries.length; l++) {
              const task = <Task> taskDir.entries[l];
              for (let j = 0; j < task.operations.length; j++) {
                const operation = task.operations[j];

                for (let k = 0; k < operation.results.length; k++) {
                  const opResult = operation.results[k];

                  if (!isNullOrUndefined(opResult.url)) {
                    this.existsFile(opResult.url).then(() => {
                      opResult.online = true;

                      if (isNullOrUndefined(opResult.file) && opResult.extension.indexOf('wav') < 0) {
                        opResult.updateContentFromURL(this.httpclient).then(() => {
                          // TODO minimize task savings
                          this.storage.saveTask(task);
                        }).catch((error) => {
                          console.error(error);
                        });
                      }
                    }).catch(() => {
                      opResult.online = false;
                    });
                  }
                }
              }
            }

            this._taskList.addEntry(taskDir);
          }
        }
        this.protocolURL = this.updateProtocolURL();
      }
      if (!isNullOrUndefined(results[1])) {
        // read userSettings
        for (let i = 0; i < results[1].length; i++) {
          const userSetting = results[1][i];

          switch (userSetting.name) {
            case ('notification'):
              this.notification.permissionGranted = userSetting.value.enabled;
              break;
            case ('defaultTaskOptions'):
              // search lang obj
              const lang = AppInfo.languages.find((a) => {
                return a.code === userSetting.value.language;
              });
              if (!isNullOrUndefined(lang)) {
                this.selectedlanguage = lang;
              }
              break;
            default:
          }
        }
        // this.notification.permissionGranted = results[1][]
      }
    }));

    this.subscrmanager.add(this.taskList.entryChanged.subscribe((event: EntryChangeEvent) => {
        console.log(`${event.state} && ${event.saveToDB}`);
        if (event.state === 'added') {
          if (event.entry instanceof Task) {
            this.listenToTaskEvents(event.entry);
          } else {
            for (let i = 0; i < event.entry.entries.length; i++) {
              const task = <Task> event.entry.entries[i];
              this.listenToTaskEvents(task);
            }
          }
          this.updateProtocolArray();

          if (event.saveToDB) {
            console.log(`add by event`);
            this.storage.saveTask(event.entry).then(() => {
              console.log(`entry with id ${event.entry.id} successfully ADDED by event`);
            }).catch((error) => {
              console.error(error);
            });
          }
        } else if (event.state === 'removed') {
          if (event.saveToDB) {
            this.storage.removeFromDB(event.entry).then(() => {
              console.log(`entry with id ${event.entry.id} successfully REMOVED by event`);
            }).catch((error) => {
              console.error(error);
            });
          } else {
            console.log(`no saving for remove ${event.entry.id}`);
          }
        } else if (event.state === 'changed') {
          // not implemented yet
        }
      }
    ));
  }

  private listenToTaskEvents(task: Task) {
    this.subscrmanager.add(task.opstatechange.subscribe((event) => {
      const operation = task.getOperationByID(event.opID);
      const opName = operation.name;
      if (opName === 'ASR' && event.newState === TaskState.FINISHED) {
        this.notification.showNotification('ASR Operation successful', `You can now edit ${task.files[0].name} with OCTRA`);
      } else if (event.newState === TaskState.ERROR) {
        this.notification.showNotification(opName + ' Operation failed', `Operation failed for ${task.files[0].name}. For more information hover over the operation`);
      } else if (opName === 'MAUS' && event.newState === TaskState.FINISHED) {
        this.notification.showNotification('MAUS Operation successful', `You can now edit ${task.files[0].name} with EMU WebApp`);
      }

      const running_tasks = this.countRunningTasks();
      this.updateProtocolArray();
      const lastOp = task.operations[task.operations.length - 1];
      if (running_tasks > 1 || (running_tasks === 1 && (lastOp.state !== TaskState.FINISHED && lastOp.state !== TaskState.READY))) {
        if (operation.state === TaskState.UPLOADING) {
          this.state = TaskState.UPLOADING;
        } else {
          this.state = TaskState.PROCESSING;
        }
      } else {
        this.state = TaskState.READY;
      }
      this.storage.saveTask(task);
      this.protocolURL = this.updateProtocolURL();
    }));
  }

  public checkFiles() {
    if (this.splitPrompt !== 'BOTH') {
      const removeList = [];
      const promises = [];

      for (let i = 0; i < this.taskList.entries.length; i++) {
        let entry = this.taskList.entries[i];

        if (entry instanceof TaskDirectory) {
          entry = <TaskDirectory> entry;
          if (entry.path.indexOf('_dir') > -1) {
            for (let j = 0; j < entry.entries.length; j++) {
              const dirEntry = <Task> entry.entries[j];
              let nothingToDo = true;
              // TODO improve this code. Determine the channel file using another way
              if (this.splitPrompt === 'FIRST') {
                if (dirEntry.state === TaskState.QUEUED && dirEntry.files[0].available && dirEntry.files[0].fullname.indexOf('_2.') > -1) {
                  console.log(`remove first`);
                  removeList.push(dirEntry);
                  nothingToDo = false;
                }
              } else if (this.splitPrompt === 'SECOND') {
                console.log(`remove second`);
                if (dirEntry.state === TaskState.QUEUED && dirEntry.files[0].available && dirEntry.files[0].fullname.indexOf('_1.') > -1) {
                  removeList.push(dirEntry);
                  nothingToDo = false;
                }
              }

              if (nothingToDo) {
                console.log(`NOTHING TO DO`);
                promises.push(this.taskList.cleanup(entry, true));
              }
            }
          }
        }
      }

      for (let i = 0; i < removeList.length; i++) {
        const removeElement = removeList[i];
        promises.push(this.taskList.removeEntry(removeElement, true));
      }

      Promise.all(promises).then(() => {
        console.log('CHECK FILES OK');
      }).catch((error) => {
        console.error(error);
      });

    }
  }

  public addEntry(entry: (Task | TaskDirectory), saveToDB: boolean = false) {
    if (entry instanceof Task || entry instanceof TaskDirectory) {
      this.taskList.addEntry(entry, saveToDB).then(() => {
        return this.taskList.cleanup(entry, saveToDB);
      }).then(() => {
        this.storage.saveCounter('taskCounter', TaskEntry.counter);
        this.storage.saveCounter('operationCounter', Operation.counter);
      }).catch((err) => {
        console.error(`could not add via taskService!`);
        console.error(`${err}`);
      });
    } else {
      console.error(`could not add Task or TaskDirectory. Invalid class instance`);
    }
  }

  public start() {
    // look for pending tasks

    const running_tasks = this.countRunningTasks();
    const uploading_task = this._taskList.getAllTasks().findIndex((task) => {
      return task.operations[0].state === 'UPLOADING';
    });
    if (running_tasks < this.options.max_running_tasks && uploading_task < 0) {
      let task: Task;

      // look for pending tasks
      task = this.findNextWaitingTask();

      if (!isNullOrUndefined(task)) {
        if (this.state !== TaskState.PROCESSING) {
          this.state = TaskState.READY;
        }

        task.statechange.subscribe((obj) => {
          this.storage.saveTask(task);
          this.protocolURL = this.updateProtocolURL();
        });
        this.storage.saveTask(task);
        task.start(this.httpclient);
        setTimeout(() => {
          this.start();
        }, 1000);
      } else {
      }
    } else {
      setTimeout(() => {
        this.start();
      }, 1000);
    }
  }

  public findNextWaitingTask(): Task {
    const tasks = this.taskList.getAllTasks();
    for (let i = 0; i < tasks.length; i++) {
      const entry = tasks[i];
      if (entry.state === TaskState.PENDING &&
        ((!isNullOrUndefined(entry.files[0].file) && entry.files[0].extension === '.wav') || entry.operations[0].results.length > 0 && entry.operations[0].lastResult.online)
      ) {
        return entry;
      } else if (entry.state === TaskState.READY) {
        for (let j = 0; j < entry.operations.length; j++) {
          const operation = entry.operations[j];
          if ((operation.state === TaskState.PENDING || operation.state === TaskState.READY) && operation.name !== 'OCTRA') {
            return entry;
          } else if (operation.state !== TaskState.FINISHED && operation.name === 'OCTRA') {
            break;
          }
        }
      }
    }

    return null;
  }

  public updateProtocolURL(): Promise<SafeResourceUrl> {
    return new Promise<SafeResourceUrl>((resolve, reject) => {

      const promises: Promise<any>[] = [];
      for (let i = 0; i < this.taskList.entries.length; i++) {
        const entry = this.taskList.entries[i];
        promises.push(entry.toAny());
      }

      Promise.all(promises).then((values) => {
        const json = {
          version: '1.0.0',
          encoding: 'UTF-8',
          created: moment().format(),
          entries: values
        };

        this.protocolFileName = 'oh_portal_' + Date.now() + '.json';
        const file = new File([JSON.stringify(json)], this.protocolFileName, {
          'type': 'text/plain'
        });

        resolve(this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(file)));
      }).catch((error) => {
        reject(error);
      });
    });
  }


  public countRunningTasks() {
    let result = 0;
    const tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (task.state === TaskState.PROCESSING || task.state === TaskState.UPLOADING) {
        result++;
      }
    }

    return result;
  }

  public countPendingTasks() {
    let result = 0;
    const tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      if (task.state === TaskState.PENDING) {
        result++;
      }
    }

    return result;
  }

  ngOnDestroy() {
    const tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      tasks[i].destroy();
    }
    this.subscrmanager.destroy();
  }

  public updateProtocolArray() {
    let result = [];
    let errors_count = 0;
    let warnings_count = 0;

    // TODO implement error and warning attributes in TaskList to improve performance
    const tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      for (let j = 0; j < task.operations.length; j++) {
        const operation = task.operations[j];

        if ((operation.state === TaskState.FINISHED || operation.state === TaskState.ERROR) && operation.protocol !== '') {
          if (operation.state === TaskState.ERROR) {
            errors_count++;
          } else {
            warnings_count++;
          }

          result.push(
            {
              task_id: task.id,
              op_name: operation.name,
              state: operation.state,
              protocol: operation.protocol
            }
          );
        }
      }
    }

    if (this.errors_count !== errors_count) {
      this.errorscountchange.emit(this.errors_count);
    }
    this._errors_count = errors_count;
    this._warnings_count = warnings_count;

    // sort protocol_array by task id
    result = result.sort((a, b) => {
      if (a.task_id > b.task_id) {
        return 1;
      } else if (a.task_id < b.task_id) {
        return -1;
      }
      return 0;
    });

    this._protocol_array = result;
  }

  public cleanUpInputArray(entries: (FileInfo | DirectoryInfo)[]): (FileInfo | DirectoryInfo)[] {
    let result: (FileInfo | DirectoryInfo)[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (entry instanceof FileInfo) {
        const file = <FileInfo> entry;
        if (file.extension === '.wav' || this.validTranscript(file.extension)) {
          result.push(file);
        }

      } else if (entry instanceof DirectoryInfo) {
        const directory = <DirectoryInfo> entry;

        const dir = directory.clone();

        dir.entries = dir.entries.filter((a) => {
          return a instanceof FileInfo && ((a.extension === '.wav') || this.validTranscript(a.extension));
        });
        const rest = directory.entries.filter((a) => {
          return a instanceof DirectoryInfo;
        });

        if (dir.entries.length > 0) {
          result.push(dir);
        }
        result = result.concat(this.cleanUpInputArray(rest));
      }
    }

    return result;
  }

  public process: (queueItem: QueueItem) => Promise<(Task | TaskDirectory)[]> = (queueItem: QueueItem) => {
    if (queueItem.file instanceof FileInfo) {
      const file = <FileInfo> queueItem.file;
      return this.processFileInfo(file, '', queueItem);
    } else if (queueItem.file instanceof DirectoryInfo) {
      const dir = <DirectoryInfo> queueItem.file;
      return this.processDirectoryInfo(dir, queueItem);
    }
  };

  private processFileInfo(file: FileInfo, path: string, queueItem: QueueItem): Promise<(Task | TaskDirectory)[]> {
    return new Promise<(Task | TaskDirectory)[]>((resolve, reject) => {
      const newName = FileInfo.escapeFileName(file.fullname);
      let newFileInfo: FileInfo = null;
      this.newfiles = true;

      new Promise<void>((res) => {
          if (newName !== file.fullname) {
            // no valid name, replace
            FileInfo.renameFile(file.file, newName, {
              type: file.type,
              lastModified: file.file.lastModifiedDate
            }).then((newfile: File) => {
              newFileInfo = new FileInfo(newfile.name, file.type, newfile.size, newfile);
              newFileInfo.attributes = queueItem.file.attributes;
              newFileInfo.attributes['originalFileName'] = file.fullname;
              file.attributes['originalFileName'] = file.fullname;
              res();
            });
          } else {
            newFileInfo = new FileInfo(file.fullname, (file.type !== '')
              ? file.type : file.file.type, file.size, file.file);
            newFileInfo.attributes = queueItem.file.attributes;
            newFileInfo.attributes['originalFileName'] = file.fullname;
            file.attributes['originalFileName'] = file.fullname;
            res();
          }
        }
      ).then(() => {
        const hash = this.preprocessor.getHashString(file.fullname, file.size);
        const foundOldFile = this.getTaskWithHash(hash);

        setTimeout(() => {
          const reader = new FileReader();
          reader.onload = (event: any) => {
            console.log(event.target.result);
            const format = new WavFormat(event.target.result);
            const isValidFormat = format.isValid(event.target.result);
            const isValidTranscript = this.validTranscript(file.extension);

            if (isValidFormat && format.channels > 1) {
              const directory = new DirectoryInfo(path + file.name + '_dir/');
              const files: File[] = format.splitChannelsToFiles(file.name, 'audio/wav', event.target.result);

              if (this._splitPrompt === 'PENDING') {
                this.openSplitModal();
                this._splitPrompt = 'ASKED';
              } else if (this._splitPrompt !== 'ASKED') {
                if (this._splitPrompt === 'FIRST') {
                  files.splice(1, 1);
                } else if (this._splitPrompt === 'SECOND') {
                  files.splice(0, 1);
                }
              }

              const fileInfos: FileInfo[] = [];

              if (files.length > 1) {
                console.log(`greater than 1`);
                for (let i = 0; i < files.length; i++) {
                  const fileObj = files[i];
                  const fileInfo = FileInfo.fromFileObject(fileObj);
                  fileInfo.attributes['originalFileName'] = `${file.name}_${i + 1}.${file.extension}`;
                  fileInfos.push(fileInfo);
                }
                directory.addEntries(fileInfos);
                this.processDirectoryInfo(directory, queueItem).then((result) => {
                  resolve(result);
                }).catch((err) => {
                  reject(err);
                });
              } else {
                // TODO ?
                // fileInfo.attributes['originalFileName'] = `${file.name}_${i + 1}.${file.extension}`;
                this.processFileInfo(FileInfo.fromFileObject(files[0]), path, queueItem).then(resolve).catch(reject);
              }

            } else if (isValidFormat || isValidTranscript) {
              if (!isValidTranscript) {
                // it's an audio file
                newFileInfo = new AudioInfo(
                  newName, file.file.type, file.file.size, format.sampleRate,
                  format.duration, format.channels, format.bitsPerSample, newFileInfo.file
                );
              } else {
              }

              if (isNullOrUndefined(newFileInfo.file)) {
                newFileInfo.file = file.file;
              }

              newFileInfo.attributes = file.attributes;
              queueItem.file = newFileInfo;

              if (!isNullOrUndefined(foundOldFile)) {

                if (!isValidTranscript || foundOldFile.files.length === 1) {
                  const oldFileIndex = foundOldFile.files.findIndex((a) => {
                    return a.fullname === newFileInfo.fullname && a.size === newFileInfo.size;
                  });
                  foundOldFile.files[oldFileIndex] = newFileInfo;
                } else {
                  // a transcript file already exists
                  foundOldFile.files.splice(1, 1);
                  foundOldFile.files.push(newFileInfo);
                }
                resolve([]);
              } else {
                const task = new Task([<FileInfo> queueItem.file], this.operations);
                task.language = this.selectedlanguage.code;

                // set state
                for (let i = 0; i < this.operations.length; i++) {
                  const operation = this.operations[i];
                  task.operations[i].enabled = operation.enabled;
                }

                resolve([task]);
              }
            } else {
              reject('no valid wave format!');
            }
          };
          reader.readAsArrayBuffer(file.file);
        }, 1000);
      });
    });
  }

  private processDirectoryInfo(dir: DirectoryInfo, queueItem: QueueItem): Promise<TaskDirectory[]> {
    return new Promise<TaskDirectory[]>((resolve, reject) => {

      const dirTask = new TaskDirectory(dir.path, dir.size);
      const promises: Promise<(Task | TaskDirectory)[]>[] = [];

      console.log(dir);
      for (let i = 0; i < dir.entries.length; i++) {
        const dirEntry = dir.entries[i];

        if (dirEntry instanceof FileInfo) {
          const file = <FileInfo> dirEntry;
          promises.push(this.processFileInfo(file, dir.path, queueItem));

        } else {
          console.error('file in dir is not a file!');
        }
      }

      Promise.all(promises).then((values) => {
        console.log('ALL PROCESSED!');
        console.log(values);
        const result = [];

        let content = [];

        values = [].concat.apply([], values);
        for (let k = 0; k < values.length; k++) {
          const value = values[k];

          if (value instanceof Task) {
            // set state
            for (let i = 0; i < this.operations.length; i++) {
              const operation = this.operations[i];
              value.operations[i].enabled = operation.enabled;
            }
            content.push(value);
          } else if (value instanceof TaskDirectory) {
            // is dir
            if (value.entries.length === 1) {
              console.log(`only 1`);
              content.push(value.entries[0]);
            } else {
              if (content.length > 0) {
                console.log(`greater 0`);
                dirTask.addEntries(content);
                result.push(dirTask);
                content = [];
              }

              result.push(value);
            }
          }
        }
        if (content.length > 0) {
          dirTask.addEntries(content);
          result.push(dirTask);
        }

        resolve(result);
      });
    });
  }

  public openSplitModal = () => {

  };

  private getTaskWithHash(hash: string): Task {
    const tasks: Task[] = this.taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task: Task = tasks[i];
      if (!isNullOrUndefined(task.files[0].attributes.originalFileName)) {
        for (let j = 0; j < task.files.length; j++) {
          const file = task.files[j];

          const cmpHash = this.preprocessor.getHashString(file.attributes.originalFileName, file.size);
          //console.log(`${cmpHash} === ${hash}`);
          if (cmpHash === hash && (task.operations[0].state === TaskState.PENDING
            || task.operations[0].state === TaskState.ERROR)) {
            return task;
          }
        }
      } else {
        console.error('could not find originalFilename');
      }
    }

    return null;
  }

  public existsFile(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.httpclient.head(url).subscribe(() => {
          resolve();
        },
        (err) => {
          reject(err);
        });
    });
  }

  public validTranscript(extension: string): boolean {
    let result = false;

    for (let k = 0; k < AppInfo.converters.length; k++) {
      const converter = AppInfo.converters[k];
      result = result || converter.obj.extension.includes(extension);
    }

    return result;
  }

  public getAppendingsExtension(file: FileInfo): string {
    for (let i = 0; i < AppInfo.converters.length; i++) {
      const converter = AppInfo.converters[i];
      if (file.fullname.includes(converter.obj.extension)) {
        return converter.obj.extension;
      }
    }

    return file.extension;
  }
}
