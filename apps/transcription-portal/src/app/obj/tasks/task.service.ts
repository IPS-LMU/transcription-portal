import {HttpClient} from '@angular/common/http';
import {EventEmitter, Injectable, OnDestroy} from '@angular/core';
import {NotificationService} from '../../shared/notification.service';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {EntryChangeEvent, Task, TaskDirectory, TaskList, TaskState} from './index';
import {OCTRAOperation} from '../operations/octra-operation';
import {UploadOperation} from '../operations/upload-operation';
import {G2pMausOperation} from '../operations/g2p-maus-operation';
import {StorageService} from '../../storage.service';
import {Preprocessor, QueueItem} from '../preprocessor';
import {AppInfo} from '../../app.info';
import {TaskEntry} from './task-entry';
import {ASROperation} from '../operations/asr-operation';
import {EmuOperation} from '../operations/emu-operation';
import {Operation} from '../operations/operation';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {AlertService} from '../../shared/alert.service';
import {firstValueFrom, interval, of} from 'rxjs';
import {AppSettings} from '../../shared/app.settings';
import {OHLanguageObject} from '../oh-config';
import {DateTime} from 'luxon';
import {readFileAsArray} from '../functions';
import {calcSHA256FromFile} from '../CryptoHelper';
import {AudioInfo, DirectoryInfo, FileInfo, WavFormat} from '@octra/web-media';
import {escapeRegex, flatten} from '@octra/utilities';

@Injectable()
export class TaskService implements OnDestroy {
  public newfiles = false;
  public overallState: 'processing' | 'waiting' | 'stopped' | 'not started' = 'not started';
  public protocolURL: SafeResourceUrl | undefined;
  public protocolFileName = '';
  public errorscountchange = new EventEmitter<number>();
  public selectedlanguage: OHLanguageObject | undefined;
  private options = {
    max_running_tasks: 3
  };
  private subscrmanager: SubscriptionManager = new SubscriptionManager();
  private state: TaskState = TaskState.READY;

  constructor(public httpclient: HttpClient, private notification: NotificationService,
              private storage: StorageService, private sanitizer: DomSanitizer,
              private alertService: AlertService) {
  }

  private _taskList: TaskList | undefined;

  get taskList(): TaskList | undefined {
    return this._taskList;
  }

  private _operations: Operation[] = [];

  get operations(): Operation[] {
    return this._operations;
  }

  private _accessCode = '';

  public get accessCode(): string {
    return this._accessCode;
  }

  public set accessCode(value: string) {
    this.storage.saveUserSettings('accessCode', value);
    this._accessCode = value;
  }

  private _statistics = {
    queued: 0,
    waiting: 0,
    running: 0,
    finished: 0,
    errors: 0
  };

  get statistics(): { queued: number; waiting: number; running: number; finished: number; errors: number } {
    return this._statistics;
  }

  private _protocolArray = [];

  get protocolArray(): any[] {
    return this._protocolArray;
  }

  private _splitPrompt = 'PENDING';

  get splitPrompt(): string {
    return this._splitPrompt;
  }

  set splitPrompt(value: string) {
    this._splitPrompt = value;
  }

  private _preprocessor: Preprocessor = new Preprocessor();

  get preprocessor(): Preprocessor {
    return this._preprocessor;
  }

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
    return '';
  }

  public init() {
    this._taskList = new TaskList();
    this._operations = [
      new UploadOperation('Upload', AppSettings.configuration.api.commands[0].calls, 'Upload', 'UL'),
      new ASROperation('ASR', AppSettings.configuration.api.commands[1].calls, 'Speech Recognition', 'ASR'),
      new OCTRAOperation('OCTRA', AppSettings.configuration.api.commands[2].calls, 'Manual Transcription', 'MT'),
      new G2pMausOperation('MAUS', AppSettings.configuration.api.commands[3].calls, 'Word alignment', 'WA'),
      new EmuOperation('Emu WebApp', AppSettings.configuration.api.commands[4].calls, 'Phonetic detail', 'PD')
    ];

    this._preprocessor.process = this.process;
    if (!this.taskList || !this._taskList) {
      throw new Error('taksList not defined');
    }

    this.subscrmanager.add(this._preprocessor.itemProcessed.subscribe(
      async (item) => {
        for (const result of item.results) {
          let foundTask: Task | undefined;
          if (result instanceof Task) {
            for (const file of result.files) {
              const escapedName = escapeRegex(result.files[0].attributes.originalFileName.replace(/(_annot)?\.[^.]+$/g, ''));
              foundTask = this.getTaskWithOriginalFileName(new RegExp(`^${escapedName}((_annot)?.[^.]+)$`));

              if (foundTask) {
                // found a task
                // file with this hash already exists, overwrite
                const oldFileIndex = foundTask.files.findIndex((a) => file && a.hash === file.hash);

                if (oldFileIndex > -1) {
                  foundTask.setFileObj(oldFileIndex, file);
                } else {
                  if (foundTask.files.length > 1) {
                    const index = file.type.indexOf('audio') > -1 ? 0 : 1;
                    foundTask.files[index] = file;
                    if (index === 1) {
                      foundTask.operations[1].enabled = false;
                    }
                  } else {
                    if (file.type.indexOf('audio') > -1) {
                      foundTask.files = [
                        file,
                        ...foundTask.files
                      ];
                      foundTask.operations[1].enabled = false;
                    } else {
                      foundTask.files.push(file);
                      foundTask.operations[1].enabled = false;
                    }
                  }
                }
                await this.storage.saveTask(foundTask);
              }
            }
            result.changeState(TaskState.QUEUED);
          } else {
            for (let j = 0; j < result.entries.length; j++) {
              const entry = result.entries[j] as Task;
              const tasks: Task[] = result.entries.filter((a) => {
                return a instanceof Task;
              }) as Task[];

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

                    (result as TaskDirectory).entries.splice(v, 1);
                    tasks.splice(v, 1);
                    v--;

                    // TODO change if other than transcript files are needed
                    entry.operations[1].enabled = false;
                    entry.operations[1].changeState(TaskState.SKIPPED);
                  }
                }
              }


              foundTask = this.taskList?.getAllTasks().find((a) => {
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
                // TODO check this
              }

              entry.changeState(TaskState.QUEUED);
            }
          }

          if ((foundTask === null || foundTask === undefined)) {
            this.addEntry(result, true);
          } else {
            foundTask.fileschange.next();
          }
        }

        if (this.preprocessor.queue.length === 0) {
          // check remaining unchecked files
          this.checkFiles();
        }
      }
    ));

    this.subscrmanager.add(this.taskList?.entryChanged.subscribe((event: EntryChangeEvent) => {
        if (event.state === 'added') {
          if (event.entry.type === 'task') {
            this.listenToTaskEvents(event.entry as Task);
          } else {
            for (const entry of (event.entry as TaskDirectory).entries) {
              const task = entry as Task;
              this.listenToTaskEvents(task);
            }
          }

          if (event.saveToDB) {
            this.storage.saveTask(event.entry).catch((error) => {
              console.error(error);
            });
          }
        } else if (event.state === 'removed') {
          if (event.saveToDB) {
            this.storage.removeFromDB(event.entry).catch((error) => {
              console.error(error);
            });
          } else {
            // TODO check this
          }
        } else if (event.state === 'changed') {
          // not implemented yet
        }
      }
    ));

    this.subscrmanager.add(interval(1000).subscribe(() => {
      this.updateStatistics();
    }));
    this.updateStatistics();
  }

  public importDBData(dbEntries: any[]) {

    const idbTasks = dbEntries[0];

    if (!(idbTasks === null || idbTasks === undefined)) {
      this.newfiles = idbTasks.length > 0;

      // make sure that taskCounter and operation counter are equal to their biggest value
      let maxTaskCounter = 0;
      let maxOperationCounter = 0;

      for (const taskObj of idbTasks) {
        if (taskObj.type === 'task') {

          if ((taskObj.asr === null || taskObj.asr === undefined)) {
            const firstLangObj = AppSettings.configuration.api.languages.find((a) => {
              return a.code === taskObj.language;
            });

            if (!(firstLangObj === null || firstLangObj === undefined)) {
              taskObj.asr = firstLangObj.asr;
            }
          }
          const task = Task.fromAny(taskObj, AppSettings.configuration.api.commands, this.operations);

          maxTaskCounter = Math.max(maxTaskCounter, task.id);

          for (const operation of task.operations) {
            maxOperationCounter = Math.max(maxOperationCounter, operation.id);

            for (const opResult of operation.results) {
              if (!(opResult.url === null || opResult.url === undefined)) {
                this.existsFile(opResult.url).then(() => {
                  opResult.online = true;

                  if ((opResult.file === null || opResult.file === undefined) && opResult.extension.indexOf('wav') < 0) {
                    opResult.updateContentFromURL(this.httpclient).then(() => {
                      // TODO minimize task savings
                      this.storage.saveTask(task);
                    }).catch((error: any) => {
                      console.error(error);
                    });
                  }
                }).catch(() => {
                  opResult.online = false;
                });
              } else {
                opResult.online = false;
              }
            }
          }

          if (!this._taskList) {
            throw new Error('taskList not defined');
          }

          this._taskList.addEntry(task).catch((err) => {
            console.error(err);
          });
        } else {
          const taskDir = TaskDirectory.fromAny(taskObj, AppSettings.configuration.api.commands, this.operations);

          for (const taskElem of taskDir.entries) {
            const task = taskElem as Task;
            for (const operation of task.operations) {

              for (const opResult of operation.results) {
                if (!(opResult.url === null || opResult.url === undefined)) {
                  this.existsFile(opResult.url).then(() => {
                    opResult.online = true;

                    if ((opResult.file === null || opResult.file === undefined) && opResult.extension.indexOf('wav') < 0) {
                      opResult.updateContentFromURL(this.httpclient).then(() => {
                        // TODO minimize task savings
                        this.storage.saveTask(task);
                      }).catch((error: any) => {
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

          if (!this._taskList) {
            throw new Error('undefined tasklist');
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
    if (!(dbEntries[1] === null || dbEntries[1] === undefined)) {
      // read userSettings
      for (const userSetting of dbEntries[1]) {
        const lang = AppSettings.getLanguageByCode(userSetting.value.language, userSetting.value.asr);

        switch (userSetting.name) {
          case ('notification'):
            this.notification.permissionGranted = userSetting.value.enabled;
            break;
          case ('defaultTaskOptions'):
            // search lang obj
            if (!(lang === null || lang === undefined)) {
              this.selectedlanguage = lang;
            }
            break;
        }
      }
      // this.notification.permissionGranted = results[1][]
    }
  }

  public checkFiles() {
    if (this.splitPrompt !== 'BOTH') {
      const removeList = [];
      const promises = [];

      if (!this.taskList) {
        throw new Error('undefined tasklist');
      }

      for (const entryElem of this.taskList.entries) {
        if (entryElem instanceof TaskDirectory) {
          const entry = entryElem as TaskDirectory;
          if (entry.path.indexOf('_dir') > -1) {
            for (const dirElem of entry.entries) {
              const dirEntry = dirElem as Task;
              let nothingToDo = true;
              // TODO improve this code. Determine the channel file using another way
              if (this.splitPrompt === 'FIRST') {
                if (dirEntry.state === TaskState.QUEUED && dirEntry.files[0].available && dirEntry.files[0].attributes.originalFileName.indexOf('_2.') > -1) {
                  removeList.push(dirEntry);
                  nothingToDo = false;
                }
              } else if (this.splitPrompt === 'SECOND') {
                if (dirEntry.state === TaskState.QUEUED && dirEntry.files[0].available && dirEntry.files[0].attributes.originalFileName.indexOf('_1.') > -1) {
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

      for (const removeElement of removeList) {
        promises.push(this.taskList.removeEntry(removeElement, true));
      }

      Promise.all(promises).catch((error) => {
        console.error(error);
      });
    }
  }

  public addEntry(entry: (Task | TaskDirectory), saveToDB: boolean = false) {
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }

    this.taskList.addEntry(entry, saveToDB).then(() => {
      if (!this.taskList) {
        throw new Error('undefined tasklist');
      }
      return this.taskList.cleanup(entry, saveToDB);
    }).catch((err) => {
      console.error(`${err}`);
    }).then(() => {
      this.saveCounters();
    }).catch((err) => {
      console.error(`could not add via taskService!`);
      console.error(`${err}`);
    });
  }

  public changeEntry(id: number, entry: (Task | TaskDirectory), saveToDB: boolean = false) {
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }

    this.taskList.changeEntry(id, entry, saveToDB).then(() => {
      if (!this.taskList) {
        throw new Error('undefined tasklist');
      }
      return this.taskList.cleanup(entry, saveToDB);
    }).catch((err) => {
      console.error(`${err}`);
    }).then(() => {
      this.saveCounters();
    }).catch((err) => {
      console.error(`could not add via taskService!`);
      console.error(`${err}`);
    });
  }

  public saveCounters() {
    this.storage.saveCounter('taskCounter', TaskEntry.counter);
    this.storage.saveCounter('operationCounter', Operation.counter);
  }

  public start() {
    // look for pending tasks
    if (this.overallState === 'processing') {
      this.updateStatistics();
      if (!this.taskList) {
        throw new Error('undefined tasklist');
      }
      const uploadingTask = this.taskList.getAllTasks().findIndex((task) => {
        return task.operations[0].state === 'UPLOADING';
      });
      if (this._statistics.running < this.options.max_running_tasks && uploadingTask < 0) {
        const task: Task | undefined = this.findNextWaitingTask();

        if (task && task.operations[1].providerInformation) {
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
          const langObj = AppSettings.getLanguageByCode(task.language, task.operations[1].providerInformation.provider);

          if (langObj) {
            task.start(langObj, this.httpclient, [
              {
                name: 'GoogleASR',
                value: this._accessCode
              }
            ]);
          } else {
            console.error('langObj is undefined');
          }
          setTimeout(() => {
            this.start();
          }, 100);
        } else {
          setTimeout(() => {
            this.start();
          }, 100);
        }
      } else {
        setTimeout(() => {
          this.start();
        }, 250);
      }
    }
  }

  public findNextWaitingTask(): Task | undefined {
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }
    const tasks = this.taskList.getAllTasks();
    for (const entry of tasks) {
      if (entry.state === TaskState.PENDING &&
        ((!(entry.files[0].file === null || entry.files[0].file === undefined)
          && entry.files[0].extension === '.wav') || entry.operations[0].results.length > 0 && entry.operations[0]?.lastResult?.online)
      ) {
        return entry;
      } else if (entry.state === TaskState.READY) {
        for (const operation of entry.operations) {
          if (operation.state !== TaskState.SKIPPED && operation.enabled) {
            if ((operation.state === TaskState.PENDING || operation.state === TaskState.READY) && !(operation.name === 'OCTRA' || operation.name === 'Emu WebApp')) {
              return entry;
            } else if (operation.state !== TaskState.FINISHED && (operation.name === 'OCTRA' || operation.name === 'Emu WebApp')) {
              break;
            }
          }
        }
      }
    }

    return undefined;
  }

  public updateProtocolURL(): Promise<SafeResourceUrl> {
    return new Promise<SafeResourceUrl>((resolve, reject) => {
      if (!this.taskList) {
        throw new Error('undefined tasklist');
      }
      const promises: Promise<any>[] = [];
      for (const entry of this.taskList.entries) {
        promises.push(entry.toAny());
      }

      Promise.all(promises).then((values) => {
        const json = {
          version: '1.0.0',
          encoding: 'UTF-8',
          created: DateTime.now().toISO(),
          entries: values
        };

        this.protocolFileName = 'oh_portal_' + Date.now() + '.json';
        const file = new File([JSON.stringify(json, null, 2)], this.protocolFileName, {
          type: 'text/plain'
        });

        const url = URL.createObjectURL(file);
        resolve(this.sanitizer.bypassSecurityTrustResourceUrl(url));
      }).catch((error) => {
        reject(error);
      });
    });
  }

  ngOnDestroy() {
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }
    const tasks = this.taskList.getAllTasks();

    for (const task of tasks) {
      task.destroy();
    }
    this.subscrmanager.destroy();
  }

  public cleanUpInputArray(entries: (FileInfo | DirectoryInfo)[]): (FileInfo | DirectoryInfo)[] {
    let result: (FileInfo | DirectoryInfo)[] = [];

    for (const entry of entries) {
      if (entry instanceof FileInfo) {
        const file = entry as FileInfo;
        if (file.extension === '.wav' || this.validTranscript(file.extension)) {
          result.push(file);
        }

      } else {
        const directory = entry as DirectoryInfo;

        const dir = directory.clone();

        dir.entries = dir.entries.filter((a: any) => {
          return a instanceof FileInfo && ((a.extension === '.wav') || this.validTranscript(a.extension));
        });
        const rest = directory.entries.filter((a: any) => {
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

  public process: (queueItem: QueueItem) => (Promise<(Task | TaskDirectory)[]>) = async (queueItem: QueueItem) => {
    if (queueItem.file instanceof FileInfo) {
      const file = queueItem.file as FileInfo;
      return await this.processFileInfo(file, '', queueItem);
    } else if (queueItem.file instanceof DirectoryInfo) {
      const dir = queueItem.file as DirectoryInfo;
      return this.processDirectoryInfo(dir, queueItem);
    }
    return firstValueFrom(of([]));
  }

  public openSplitModal = () => {
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

    for (const converter of AppInfo.converters) {
      result = result || converter.obj.extension.includes(extension);
    }

    return result;
  }

  public getAppendingsExtension(file: FileInfo): string {
    for (const converter of AppInfo.converters) {
      if (file.fullname.includes(converter.obj.extension)) {
        return converter.obj.extension;
      }
    }

    return file.extension;
  }

  public toggleProcessing() {
    this.overallState = (this.overallState === 'processing') ? 'stopped' : 'processing';
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }
    const tasks = this.taskList.getAllTasks();
    if (this.overallState === 'processing') {
      for (const task of tasks) {
        task.resumeTask();
      }

      this.start();
    } else {

      for (const task of tasks) {
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
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }
    const tasks = this.taskList.getAllTasks();

    for (const task of tasks) {
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

  private listenToTaskEvents(task: Task) {
    this.subscrmanager.add(task.opstatechange.subscribe((event) => {
      const operation = task.getOperationByID(event.opID);
      if (!operation) {
        return;
      }
      const opName = operation.name;
      const fileName = (task.files[0].attributes?.originalFileName ?? task.files[0].fullname).replace(/\.[^.]+$/g, '');

      if (opName === 'ASR' && event.newState === TaskState.FINISHED) {
        this.notification.showNotification(`"${operation.title}" successful`, `You can now transcribe ${fileName} manually.`);
      } else if (event.newState === TaskState.ERROR) {
        this.notification.showNotification('"' + operation.title + '" Operation failed', `Operation failed for ${fileName}.
 For more information hover over the red "X" icon.`);
      } else if (opName === 'MAUS' && event.newState === TaskState.FINISHED) {
        this.notification.showNotification(`"${operation.title}" successful`, `You can now open phonetic
  details of ${fileName}.`);
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

  private async processFileInfo(file: FileInfo, path: string, queueItem: QueueItem): Promise<(Task | TaskDirectory)[]> {
    if (!(file?.file)) {
      throw new Error('file is undefined');
    }

    file.hash = await this.preprocessor.getHashString(file.file);
    const hashString = file.hash.length === 64 ? file.hash.slice(-20) : file.hash;
    const newName = `${hashString}${file.extension}`;
    let newFileInfo: FileInfo | undefined;
    this.newfiles = true;

    if (newName !== file.fullname) {
      // no valid name, replace
      const newfile = await FileInfo.renameFile(file.file, newName, {
        type: file.type,
        lastModified: file.file.lastModified
      });
      newFileInfo = new FileInfo(newfile.name, file.type, newfile.size, newfile);
      newFileInfo.attributes = queueItem.file.attributes;
      newFileInfo.attributes.originalFileName = file.fullname;
      newFileInfo.hash = file.hash;
      file = newFileInfo;
    } else {
      newFileInfo = new FileInfo(file.fullname, (file.type !== '')
        ? file.type : file.file.type, file.size, file.file);
      newFileInfo.attributes = queueItem.file.attributes;
      newFileInfo.attributes.originalFileName = file.fullname;
      newFileInfo.hash = file.hash;
      newFileInfo.attributes.originalFileName = file.fullname;
      file = newFileInfo;
    }

    if (!(file?.file)) {
      throw new Error('file is undefined');
    }
    if (!(file?.hash)) {
      throw new Error('hash is undefined');
    }

    const foundOldFile = this.getTaskWithHashAndName(file.hash, file.attributes.originalFileName);

    if (file?.file) {
      const arrayBuffer = await readFileAsArray(file.file);
      const format = new WavFormat();
      const isValidFormat = format.isValid(arrayBuffer);
      const isValidTranscript = this.validTranscript(file.extension);

      if (isValidFormat) {
        format.init(file.fullname, arrayBuffer);
        if (format.channels > 1) {
          const directory = new DirectoryInfo(path + file.attributes.originalFileName.replace(/\..+$/g, '') + '_dir/');
          const files = await format.splitChannelsToFiles(file.attributes.originalFileName.replace(/\..+$/g, ''), 'audio/wav', arrayBuffer);

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
              fileInfo.hash = await calcSHA256FromFile(fileObj);
              fileInfo.attributes.originalFileName = `${file.attributes.originalFileName.replace(/\..+$/g, '')}_${i + 1}.${file.extension}`;
              fileInfos.push(fileInfo);
            }
            directory.addEntries(fileInfos);
            const result = await this.processDirectoryInfo(directory, queueItem);
            return result;
          } else {
            return this.processFileInfo(FileInfo.fromFileObject(files[0]), path, queueItem)
          }
        } else {
          // it's an audio file
          newFileInfo = new AudioInfo(
            newName, file.file.type, file.file.size, format.sampleRate,
            format.duration, format.channels, format.bitsPerSample);
          newFileInfo.hash = file.hash;
        }
      } else if (!isValidTranscript) {
        this.alertService.showAlert('danger', `The audio file '${file.fullname}' is invalid.
              Only Wave (*.wav) files with 16 Bit signed Int are supported.`, -1);
        throw new Error('no valid wave format!');
      }

      if (newFileInfo) {
        if ((newFileInfo.file === null || newFileInfo.file === undefined)) {
          newFileInfo.file = file.file;
        }

        newFileInfo.attributes = {
          ...file.attributes
        };

        // new file
        const task = new Task([newFileInfo], this.operations);
        task.language = this.selectedlanguage?.code;
        task.asr = this.selectedlanguage?.asr;

        // set state
        for (let i = 0; i < this.operations.length; i++) {
          const operation = this.operations[i];
          task.operations[i].enabled = operation.enabled;
        }

        return [task];
      } else {
        throw new Error('fileinfo is undefined');
      }
    } else {
      throw new Error('file is null');
    }
  }

  private async processDirectoryInfo(dir: DirectoryInfo, queueItem: QueueItem): Promise<TaskDirectory[]> {
    const dirTask = new TaskDirectory(dir.path, dir.size);
    const processedValues: any = [];

    for (const dirEntry of dir.entries) {
      if (dirEntry instanceof FileInfo) {
        const file = dirEntry as FileInfo;
        processedValues.push(await this.processFileInfo(file, dir.path, queueItem));
      } else {
        throw new Error('file in dir is not a file!');
      }
    }
    const result = [];
    let content = [];

    const values = flatten(processedValues) as (Task | TaskDirectory)[];

    for (const value of values) {
      if (value instanceof Task) {
        // set state
        for (let i = 0; i < this.operations.length; i++) {
          const operation = this.operations[i];
          value.operations[i].enabled = operation.enabled;
        }
        content.push(value);
      } else {
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

    return result;
  }

  private getTaskWithHashAndName(hash: string, name: string): Task | undefined {
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }

    const tasks: Task[] = this.taskList.getAllTasks();

    for (const task of tasks) {
      if (!(task.files[0].attributes.originalFileName === null || task.files[0].attributes.originalFileName === undefined)) {
        for (const file of task.files) {
          const cmpHash = file.hash ?? `${file.name}_${file.size}`;
          // console.log(`${cmpHash} === ${hash}`);
          if (cmpHash === hash && file.attributes.originalFileName === name && (task.operations[0].state === TaskState.PENDING
            || task.operations[0].state === TaskState.ERROR)) {
            return task;
          }
        }
      } else {
        console.error('could not find originalFilename');
      }
    }

    return undefined;
  }

  private getTaskWithOriginalFileName(regex: RegExp): Task | undefined {
    if (!this.taskList) {
      throw new Error('undefined tasklist');
    }

    const tasks: Task[] = this.taskList.getAllTasks();

    for (const task of tasks) {
      if (task.files[0].attributes.originalFileName) {
        for (const file of task.files) {
          // console.log(`${cmpHash} === ${hash}`);
          if ((task.operations[0].state === TaskState.PENDING || task.operations[0].state === TaskState.QUEUED
            || task.operations[0].state === TaskState.ERROR) && regex.exec(file.attributes.originalFileName) !== null) {
            return task;
          }
        }
      } else {
        console.error('could not find originalFilename');
      }
    }

    return undefined;
  }
}
