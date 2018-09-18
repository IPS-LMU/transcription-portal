import {HttpClient} from '@angular/common/http';
import {EventEmitter, Injectable, OnDestroy} from '@angular/core';
import {NotificationService} from '../../shared/notification.service';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {EntryChangeEvent, Task, TaskDirectory, TaskList, TaskState} from './index';
import {OCTRAOperation} from '../operations/octra-operation';
import {UploadOperation} from '../operations/upload-operation';
import {G2pMausOperation} from '../operations/g2p-maus-operation';
import {FileInfo} from '../fileInfo';
import {DirectoryInfo} from '../directoryInfo';
import {StorageService} from '../../storage.service';
import {Preprocessor, QueueItem} from '../preprocessor';
import {WavFormat} from '../audio/AudioFormats/index';
import {AudioInfo} from '../audio/index';
import {AppInfo} from '../../app.info';
import {TaskEntry} from './task-entry';
import {ASROperation} from '../operations/asr-operation';
import {EmuOperation} from '../operations/emu-operation';
import {Operation} from '../operations/operation';
import * as moment from 'moment';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {AlertService} from '../../shared/alert.service';
import {Observable} from 'rxjs';

@Injectable()
export class TaskService implements OnDestroy {
  get statistics(): { queued: number; waiting: number; running: number; finished: number; errors: number } {
    return this._statistics;
  }

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

  private _statistics = {
    queued: 0,
    waiting: 0,
    running: 0,
    finished: 0,
    errors: 0
  };

  private _protocol_array = [];
  private _splitPrompt = 'PENDING';

  public overallState: 'processing' | 'waiting' | 'stopped' | 'not started' = 'not started';

  public protocolURL: SafeResourceUrl;
  public protocolFileName = '';

  public errorscountchange = new EventEmitter<number>();

  public selectedlanguage = AppInfo.languages[0];
  private state: TaskState = TaskState.READY;

  private _preprocessor: Preprocessor = new Preprocessor();

  public get isProcessing(): boolean {
    return (this.overallState === 'processing');
  }

  public get stateLabel(): string {
    if (this.overallState === 'processing') {

      if (this._statistics.running === 0) {
        if (this._statistics.waiting > 1) {
          return `${this._statistics.waiting} tasks need your attention`;
        } else if (this._statistics.waiting === 1) {
          return `1 task needs your attention`;
        }

        if (this._statistics.queued > 0) {
          return `${this._statistics.queued} audio file(s) waiting to be verified by you.`;
        }

        return 'All jobs done. Waiting for new tasks...';
      }

      return 'Processing...';
    } else if (this.overallState === 'not started') {

      if (this._statistics.queued > 0) {
        return `${this._statistics.queued} audio file(s) waiting to be verified by you.`;
      }
      return 'Ready';
    }
    if (this.overallState === 'stopped') {

      if (this._statistics.running > 0) {
        return `waiting for ${this._statistics.running} tasks to stop their work...`;
      }
      return 'Stopped';
    }
  }

  constructor(public httpclient: HttpClient, private notification: NotificationService,
              private storage: StorageService, private sanitizer: DomSanitizer,
              private alertService: AlertService) {
    this._taskList = new TaskList();
    this._operations = [
      new UploadOperation('Upload', 'Upload', 'UL'),
      new ASROperation('ASR', 'Speech Recognition', 'ASR'),
      // new ToolOperation('OCTRA'),
      new OCTRAOperation('OCTRA', 'Manual Transcription', 'MT'),
      new G2pMausOperation('MAUS', 'Word alignment', 'WA'),
      new EmuOperation('Emu WebApp', 'Phonetic detail', 'PD')
    ];

    this._preprocessor.process = this.process;

    this.subscrmanager.add(this._preprocessor.itemProcessed.subscribe(
      (item) => {
        for (let i = 0; i < item.results.length; i++) {
          const result = item.results[i];
          let foundTask: Task = null;

          if (result instanceof Task) {
            result.changeState(TaskState.QUEUED);

            foundTask = this.taskList.getAllTasks().find((a) => {
              const foundIt = a.files.find((b) => {
                // TODO CHANGE!
                return b.name.replace('_annot', '') === result.files[0].name;
              });
              return a.state === TaskState.QUEUED && !(foundIt === null || foundIt === undefined);
            });

            if (!(foundTask === null || foundTask === undefined) && !(foundTask.files[0].extension === '.wav'
              && result.files[0].extension === '.wav')) {
              console.log(`ADD ${result.files[0].extension} to ${foundTask.files[0].extension}`);
              foundTask.addFile(result.files[0]);
              if (foundTask.files.length > 1) {
                // TODO change if other than transcript files are needed
                foundTask.operations[1].enabled = false;
                foundTask.operations[1].changeState(TaskState.SKIPPED);
              }
              this.storage.saveTask(foundTask);
            }
          } else {
            for (let j = 0; j < result.entries.length; j++) {
              const entry = <Task> result.entries[j];
              const tasks: Task[] = <Task[]> result.entries.filter((a) => {
                return a instanceof Task;
              });

              // search for grouped files in this new directory
              for (let v = j + 1; v < tasks.length; v++) {
                const task = tasks[v];

                const foundIt = task.files.find((b) => {
                  // console.log(`${result.files[0].name} === ${b.name} && ${a.state}`);
                  return b.name === entry.files[0].name;
                });

                if (!(foundIt === null || foundIt === undefined)) {
                  if (!(task.files[0].extension === '.wav'
                    && entry.files[0].extension === '.wav')) {

                    entry.addFile(task.files[0]);

                    (<TaskDirectory> result).entries.splice(v, 1);
                    tasks.splice(v, 1);
                    v--;

                    // TODO change if other than transcript files are needed
                    entry.operations[1].enabled = false;
                    entry.operations[1].changeState(TaskState.SKIPPED);
                  }
                }
              }


              foundTask = this.taskList.getAllTasks().find((a) => {
                const foundIt = a.files.find((b) => {
                  // console.log(`${result.files[0].name} === ${b.name} && ${a.state}`);
                  return b.name === entry.files[0].name;
                });

                return a.state === TaskState.QUEUED && !(foundIt === null || foundIt === undefined);
              });

              if (!(foundTask === null || foundTask === undefined) && !(foundTask.files[0].extension === '.wav'
                && entry.files[0].extension === '.wav')) {
                foundTask.setFileObj(0, entry.files[0]);
                foundTask.setFileObj(1, entry.files[1]);

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

          if ((foundTask === null || foundTask === undefined)) {
            this.addEntry(result, true);
          }
        }

        if (this.preprocessor.queue.length === 0) {
          // check remaining unchecked files
          this.checkFiles();
        }
      }
    ));

    this.subscrmanager.add(this.storage.allloaded.subscribe((results) => {
      const IDBtasks = results[0];

      if (!(IDBtasks === null || IDBtasks === undefined)) {
        this.newfiles = IDBtasks.length > 0;

        // make sure that taskCounter and operation counter are equal to their biggest value
        let maxTaskCounter = 0;
        let maxOperationCounter = 0;

        for (let i = 0; i < IDBtasks.length; i++) {
          const taskObj = IDBtasks[i];
          if (taskObj.type === 'task') {
            const task = Task.fromAny(taskObj, this.operations);

            maxTaskCounter = Math.max(maxTaskCounter, task.id);

            for (let j = 0; j < task.operations.length; j++) {
              const operation = task.operations[j];

              maxOperationCounter = Math.max(maxOperationCounter, operation.id);

              for (let k = 0; k < operation.results.length; k++) {
                const opResult = operation.results[k];
                if (!(opResult.url === null || opResult.url === undefined)) {
                  this.existsFile(opResult.url).then(() => {
                    opResult.online = true;

                    if ((opResult.file === null || opResult.file === undefined) && opResult.extension.indexOf('wav') < 0) {
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

            this._taskList.addEntry(task).catch((err) => {
              console.error(err);
            });
          } else {
            const taskDir = TaskDirectory.fromAny(taskObj, this.operations);

            for (let l = 0; l < taskDir.entries.length; l++) {
              const task = <Task> taskDir.entries[l];
              for (let j = 0; j < task.operations.length; j++) {
                const operation = task.operations[j];

                for (let k = 0; k < operation.results.length; k++) {
                  const opResult = operation.results[k];

                  if (!(opResult.url === null || opResult.url === undefined)) {
                    this.existsFile(opResult.url).then(() => {
                      opResult.online = true;

                      if ((opResult.file === null || opResult.file === undefined) && opResult.extension.indexOf('wav') < 0) {
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

            this._taskList.addEntry(taskDir).catch((err) => {
              console.error(err);
            });
          }
        }

        if (TaskEntry.counter < maxTaskCounter) {
          console.warn(`Warning: Task counter was less than the biggest id. Reset counter.`);
          TaskEntry.counter = maxTaskCounter;
        }

        if (Operation.counter < maxOperationCounter) {
          console.warn(`Warning: Operation counter was less than the biggest id. Reset counter.`);
          Operation.counter = maxOperationCounter;
        }

        this.updateProtocolURL().then((url) => {
          this.protocolURL = url;
        });
      }
      if (!(results[1] === null || results[1] === undefined)) {
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
              if (!(lang === null || lang === undefined)) {
                this.selectedlanguage = lang;
              }
              break;
          }
        }
        // this.notification.permissionGranted = results[1][]
      }
    }));

    this.subscrmanager.add(this.taskList.entryChanged.subscribe((event: EntryChangeEvent) => {
        if (event.state === 'added') {
          if (event.entry instanceof Task) {
            this.listenToTaskEvents(event.entry);
          } else {
            for (let i = 0; i < event.entry.entries.length; i++) {
              const task = <Task> event.entry.entries[i];
              this.listenToTaskEvents(task);
            }
          }

          if (event.saveToDB) {
            this.storage.saveTask(event.entry).then(() => {
            }).catch((error) => {
              console.error(error);
            });
          }
        } else if (event.state === 'removed') {
          if (event.saveToDB) {
            this.storage.removeFromDB(event.entry).then(() => {
            }).catch((error) => {
              console.error(error);
            });
          } else {
          }
        } else if (event.state === 'changed') {
          // not implemented yet
        }
      }
    ));

    this.subscrmanager.add(Observable.interval(1000).subscribe(() => {
      this.updateStatistics();
    }));
    this.updateStatistics();
  }

  private listenToTaskEvents(task: Task) {
    this.subscrmanager.add(task.opstatechange.subscribe((event) => {
      const operation = task.getOperationByID(event.opID);
      const opName = operation.name;
      if (opName === 'ASR' && event.newState === TaskState.FINISHED) {
        this.notification.showNotification(`"${operation.title}" successful`, `You can now transcribe ${task.files[0].name} manually.`);
      } else if (event.newState === TaskState.ERROR) {
        this.notification.showNotification('"' + operation.title + '" Operation failed', `Operation failed for ${task.files[0].name}.
 For more information hover over the red "X" icon.`);
      } else if (opName === 'MAUS' && event.newState === TaskState.FINISHED) {
        this.notification.showNotification(`"${operation.title}" successful`, `You can now open phonetic
  details of ${task.files[0].name}.`);
      }

      this.updateStatistics();
      const lastOp = task.operations[task.operations.length - 1];
      if (this._statistics.running > 1 || (this._statistics.running === 1
        && (lastOp.state !== TaskState.FINISHED && lastOp.state !== TaskState.READY))) {
        if (operation.state === TaskState.UPLOADING) {
          this.state = TaskState.UPLOADING;
        } else {
          this.state = TaskState.PROCESSING;
        }
      } else {
        this.state = TaskState.READY;
      }
      this.storage.saveTask(task);

      this.updateProtocolURL().then((url) => {
        this.protocolURL = url;
      });
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
                  removeList.push(dirEntry);
                  nothingToDo = false;
                }
              } else if (this.splitPrompt === 'SECOND') {
                if (dirEntry.state === TaskState.QUEUED && dirEntry.files[0].available && dirEntry.files[0].fullname.indexOf('_1.') > -1) {
                  removeList.push(dirEntry);
                  nothingToDo = false;
                }
              }

              if (nothingToDo) {
                promises.push(this.taskList.cleanup(entry, true));
                this.saveCounters();
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


      }).catch((error) => {
        console.error(error);
      });

    }
  }

  public addEntry(entry: (Task | TaskDirectory), saveToDB: boolean = false) {
    if (entry instanceof Task || entry instanceof TaskDirectory) {
      this.taskList.addEntry(entry, saveToDB).then(() => {
        return this.taskList.cleanup(entry, saveToDB);
      }).catch((err) => {
        console.error(`${err}`);
      }).then(() => {
        this.saveCounters();
      }).catch((err) => {
        console.error(`could not add via taskService!`);
        console.error(`${err}`);
      });
    } else {
      console.error(`could not add Task or TaskDirectory. Invalid class instance`);
    }
  }

  public saveCounters() {
    this.storage.saveCounter('taskCounter', TaskEntry.counter);
    this.storage.saveCounter('operationCounter', Operation.counter);
  }

  public start() {
    // look for pending tasks

    if (this.overallState === 'processing') {
      this.updateStatistics();
      const uploading_task = this._taskList.getAllTasks().findIndex((task) => {
        return task.operations[0].state === 'UPLOADING';
      });
      if (this._statistics.running < this.options.max_running_tasks && uploading_task < 0) {
        let task: Task;

        // look for pending tasks
        task = this.findNextWaitingTask();

        if (!(task === null || task === undefined)) {
          if (this.state !== TaskState.PROCESSING) {
            this.state = TaskState.READY;
          }

          task.statechange.subscribe((obj) => {
            this.storage.saveTask(task);

            this.updateProtocolURL().then((url) => {
              this.protocolURL = url;
            });
          });
          this.storage.saveTask(task);
          task.start(this.httpclient);
          setTimeout(() => {
            this.start();
          }, 1000);
        } else {
          setTimeout(() => {
            this.start();
          }, 1000);
        }
      } else {
        setTimeout(() => {
          this.start();
        }, 1000);
      }
    }
  }

  public findNextWaitingTask(): Task {
    const tasks = this.taskList.getAllTasks();
    for (let i = 0; i < tasks.length; i++) {
      const entry = tasks[i];
      if (entry.state === TaskState.PENDING &&
        ((!(entry.files[0].file === null || entry.files[0].file === undefined)
          && entry.files[0].extension === '.wav') || entry.operations[0].results.length > 0 && entry.operations[0].lastResult.online)
      ) {
        return entry;
      } else if (entry.state === TaskState.READY) {
        for (let j = 0; j < entry.operations.length; j++) {
          const operation = entry.operations[j];
          if (operation.state !== TaskState.SKIPPED && operation.enabled) {
            if ((operation.state === TaskState.PENDING || operation.state === TaskState.READY) && operation.name !== 'OCTRA') {
              return entry;
            } else if (operation.state !== TaskState.FINISHED && operation.name === 'OCTRA') {
              break;
            }
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
        const file = new File([JSON.stringify(json, null, 2)], this.protocolFileName, {
          'type': 'text/plain'
        });

        const url = URL.createObjectURL(file);
        resolve(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      }).catch((error) => {
        reject(error);
      });
    });
  }

  ngOnDestroy() {
    const tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      tasks[i].destroy();
    }
    this.subscrmanager.destroy();
  }

  public cleanUpInputArray(entries: (FileInfo | DirectoryInfo)[]): (FileInfo | DirectoryInfo)[] {
    let result: (FileInfo | DirectoryInfo)[] = [];

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (entry instanceof FileInfo) {
        const file = <FileInfo> entry;
        if (file.extension === '.wav' || this.validTranscript(file.extension)) {
          if (this.validTranscript(file.extension)) {
            console.log(`valid transcript file`);
          }
          result.push(file);
        }

      } else {
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
  }

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

              if ((newFileInfo.file === null || newFileInfo.file === undefined)) {
                newFileInfo.file = file.file;
              }

              newFileInfo.attributes = file.attributes;
              queueItem.file = newFileInfo;

              if (!(foundOldFile === null || foundOldFile === undefined)) {

                if (!isValidTranscript || foundOldFile.files.length === 1) {
                  const oldFileIndex = foundOldFile.files.findIndex((a) => {
                    return a.fullname === newFileInfo.fullname && a.size === newFileInfo.size;
                  });
                  foundOldFile.setFileObj(oldFileIndex, newFileInfo);
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
              this.alertService.showAlert('danger', `The audio file '${file.fullname}' is invalid.
              Only Wave (*.wav) files with 16 Bit signed Int are supported.`, -1);
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
              content.push(value.entries[0]);
            } else {
              if (content.length > 0) {
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

  }

  private getTaskWithHash(hash: string): Task {
    const tasks: Task[] = this.taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task: Task = tasks[i];
      if (!(task.files[0].attributes.originalFileName === null || task.files[0].attributes.originalFileName === undefined)) {
        for (let j = 0; j < task.files.length; j++) {
          const file = task.files[j];

          const cmpHash = this.preprocessor.getHashString(file.attributes.originalFileName, file.size);
          // console.log(`${cmpHash} === ${hash}`);
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

    console.log(`${extension} is valid = ${result}`);

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

  public toggleProcessing() {
    this.overallState = (this.overallState === 'processing') ? 'stopped' : 'processing';

    const tasks = this.taskList.getAllTasks();
    if (this.overallState === 'processing') {
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        task.resumeTask();
      }

      this.start();
    } else {

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        task.stopTask();
      }
    }
  }

  public updateStatistics() {
    const result = {
      queued: 0,
      waiting: 0,
      running: 0,
      finished: 0,
      errors: 0
    };

    const tasks = this._taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      // running
      if (task.state === TaskState.PROCESSING || task.state === TaskState.UPLOADING) {
        result.running++;
      }

      // waiting
      if (task.state === TaskState.PENDING || task.state === TaskState.READY) {
        result.waiting++;
      }

      // queued
      if (task.state === TaskState.QUEUED) {
        result.queued++;
      }

      // finished
      if (task.state === TaskState.FINISHED) {
        result.finished++;
      }

      // failed
      if (task.state === TaskState.ERROR) {
        result.errors++;
      }
    }

    this._statistics = result;
  }
}
