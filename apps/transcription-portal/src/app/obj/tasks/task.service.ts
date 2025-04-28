import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable, OnDestroy } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ServiceProvider } from '@octra/ngx-components/lib/components/asr-options/types';
import { escapeRegex, flatten, SubscriptionManager } from '@octra/utilities';
import {
  AudioCutter,
  AudioFormat,
  AudioInfo,
  AudioManager,
  DirectoryInfo,
  FileInfo,
  getAudioInfo,
} from '@octra/web-media';
import { firstValueFrom, interval, of, Subscription } from 'rxjs';
import { AppInfo } from '../../app.info';
import { AlertService } from '../../shared/alert.service';
import { AppSettings } from '../../shared/app.settings';
import { NotificationService } from '../../shared/notification.service';
import { StorageService } from '../../storage.service';
import { calcSHA256FromFile } from '../CryptoHelper';
import { readFileAsArray } from '../functions';
import { IDBTaskItem, IDBUserSettingsItem } from '../IndexedDBManager';
import { ASROperation } from '../operations/asr-operation';
import { EmuOperation } from '../operations/emu-operation';
import { G2pMausOperation } from '../operations/g2p-maus-operation';
import { OCTRAOperation } from '../operations/octra-operation';
import { Operation } from '../operations/operation';
import { SummarizationOperation } from '../operations/summarization-operation';
import { TranslationOperation } from '../operations/translation-operation';
import { UploadOperation } from '../operations/upload-operation';
import { Preprocessor, QueueItem } from '../preprocessor';
import {
  EntryChangeEvent,
  Task,
  TaskDirectory,
  TaskList,
  TaskStatus,
} from './index';
import { TaskEntry } from './task-entry';

export type PortalModeType = 'annotation' | 'summarization';

export class PortalModeState {
  newFiles = false;
  public newfiles = false;
  public overallState: 'processing' | 'waiting' | 'stopped' | 'not started' =
    'not started';
  public selectedMausLanguage?: string;
  public selectedASRLanguage?: string;
  public selectedProvider?: ServiceProvider;
  private _status: TaskStatus = TaskStatus.READY;
  private _preprocessor!: Preprocessor;
  private subscrManager = new SubscriptionManager();

  get preprocessor(): Preprocessor {
    return this._preprocessor;
  }

  get status(): TaskStatus {
    return this._status;
  }

  private _taskList: TaskList | undefined;

  get taskList(): TaskList | undefined {
    return this._taskList;
  }

  private _operations: Operation[] = [];

  get operations(): Operation[] {
    return this._operations;
  }

  init(
    operations: Operation[],
    mode: PortalModeType,
    process: (
      queueItem: QueueItem,
      mode: PortalModeType,
    ) => Promise<(Task | TaskDirectory)[]>,
  ) {
    this._taskList = new TaskList();
    this._preprocessor = new Preprocessor(mode);
    this._preprocessor.process = process;
    this._operations = operations;
  }

  changeStatus(newStatus: TaskStatus) {
    this._status = newStatus;
  }

  destroy() {
    this.subscrManager.destroy();
  }
}

export class PortalState {
  modes: {
    annotation: PortalModeState;
    summarization: PortalModeState;
  } = {
    annotation: new PortalModeState(),
    summarization: new PortalModeState(),
  };

  currentMode: PortalModeType = 'annotation';

  get currentModeState(): PortalModeState {
    return this.modes[this.currentMode];
  }
}

@Injectable({ providedIn: 'root' })
export class TaskService implements OnDestroy {
  public protocolURL: SafeResourceUrl | undefined;
  public protocolFileName = '';
  public errorscountchange = new EventEmitter<number>();

  public readonly state = new PortalState();

  private options = {
    max_running_tasks: 3,
  };

  private subscrmanager = new SubscriptionManager<Subscription>();
  dbImported = new EventEmitter<void>();

  constructor(
    public httpclient: HttpClient,
    private notification: NotificationService,
    private storage: StorageService,
    private sanitizer: DomSanitizer,
    private alertService: AlertService,
  ) {}

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
    errors: 0,
  };

  get statistics(): {
    queued: number;
    waiting: number;
    running: number;
    finished: number;
    errors: number;
  } {
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

  public get isProcessing(): boolean {
    return this.state.currentModeState.overallState === 'processing';
  }

  public get stateLabel(): string {
    if (this.state.currentModeState.overallState === 'processing') {
      if (this._statistics.running === 0) {
        if (this._statistics.waiting > 1) {
          return `${this._statistics.waiting} tasks need your attention`;
        } else if (this._statistics.waiting === 1) {
          return `1 task needs your attention`;
        }

        if (this._statistics.queued > 0) {
          return `${this._statistics.queued} audio file(s) are waiting to be verified by you.`;
        }

        return 'All jobs done. Waiting for new tasks...';
      }

      return 'Processing...';
    } else if (this.state.currentModeState.overallState === 'not started') {
      if (this._statistics.queued > 0) {
        return `${this._statistics.queued} audio file(s) are waiting to be verified by you.`;
      }
      return 'Ready';
    }
    if (this.state.currentModeState.overallState === 'stopped') {
      if (this._statistics.running > 0) {
        return `waiting for ${this._statistics.running} tasks to stop their work...`;
      }
      return 'Stopped';
    }
    return '';
  }

  public init() {
    this.state.modes.annotation.init(
      [
        new UploadOperation(
          'Upload',
          AppSettings.configuration.api.commands[0].calls,
          'Upload',
          'UL',
        ),
        new ASROperation(
          'ASR',
          AppSettings.configuration.api.commands[1].calls,
          'Speech Recognition',
          'ASR',
        ),
        new OCTRAOperation(
          'OCTRA',
          AppSettings.configuration.api.commands[2].calls,
          'Manual Transcription',
          'MT',
        ),
        new G2pMausOperation(
          'MAUS',
          AppSettings.configuration.api.commands[3].calls,
          'Word alignment',
          'WA',
        ),
        new EmuOperation(
          'Emu WebApp',
          AppSettings.configuration.api.commands[4].calls,
          'Phonetic detail',
          'PD',
        ),
      ],
      'annotation',
      this.process,
    );

    this.state.modes.summarization.init(
      [
        new UploadOperation(
          'Upload',
          AppSettings.configuration.api.commands[0].calls,
          'Upload',
          'UL',
        ),
        new ASROperation(
          'ASR',
          AppSettings.configuration.api.commands[1].calls,
          'Speech Recognition',
          'ASR',
        ),
        new OCTRAOperation(
          'OCTRA',
          AppSettings.configuration.api.commands[2].calls,
          'Manual Transcription',
          'MT',
        ),
        new SummarizationOperation(
          'Summarization',
          [''],
          'Summarization',
          'SUM',
        ),
        new TranslationOperation('Translation', [''], 'Translation', 'TR'),
      ],
      'summarization',
      this.process,
    );

    this.subscrmanager.add(
      this.state.modes.annotation.preprocessor.itemProcessed.subscribe(
        this.onItemProcessed('annotation'),
      ),
    );
    this.subscrmanager.add(
      this.state.modes.annotation.taskList?.entryChanged.subscribe(
        this.onTaskListEntryChanged('annotation'),
      ),
    );

    this.subscrmanager.add(
      this.state.modes.summarization.preprocessor.itemProcessed.subscribe(
        this.onItemProcessed('summarization'),
      ),
    );
    this.subscrmanager.add(
      this.state.modes.summarization.taskList?.entryChanged.subscribe(
        this.onTaskListEntryChanged('summarization'),
      ),
    );

    this.subscrmanager.add(
      interval(1000).subscribe(() => {
        this.updateStatistics();
      }),
    );
    this.updateStatistics();
  }

  private onTaskListEntryChanged = (mode: PortalModeType) => {
    // TODO save to related task
    return (event: EntryChangeEvent) => {
      if (event.state === 'added') {
        if (event.entry.type === 'task') {
          this.listenToTaskEvents(event.entry as Task, mode);
        } else {
          for (const entry of (event.entry as TaskDirectory).entries) {
            const task = entry as Task;
            this.listenToTaskEvents(task, mode);
          }
        }

        if (event.saveToDB) {
          this.storage.saveTask(event.entry, mode).catch((error) => {
            console.error(error);
          });
        }
      } else if (event.state === 'removed') {
        if (event.saveToDB) {
          this.storage.removeFromDB(event.entry, mode).catch((error) => {
            console.error(error);
          });
        } else {
          // TODO check this
        }
      } else if (event.state === 'changed') {
        // not implemented yet
      }
    };
  };

  private onItemProcessed = (mode: PortalModeType) => {
    return async (item: QueueItem) => {
      for (const result of item.results) {
        let foundTask: Task | undefined;
        if (result instanceof Task) {
          for (const file of result.files) {
            const escapedName = escapeRegex(
              result.files[0].attributes.originalFileName.replace(
                /(_annot)?\.[^.]+$/g,
                '',
              ),
            );
            foundTask = this.getTaskWithOriginalFileName(
              new RegExp(`^${escapedName}((_annot)?.[^.]+)$`),
              mode,
            );

            if (foundTask) {
              // found a task
              // file with this hash already exists, overwrite
              const oldFileIndex = foundTask.files.findIndex(
                (a) => file && a.hash === file.hash,
              );

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
                    foundTask.files = [file, ...foundTask.files];
                    foundTask.operations[1].enabled = false;
                  } else {
                    foundTask.files.push(file);
                    foundTask.operations[1].enabled = false;
                  }
                }
              }
              await this.storage.saveTask(foundTask, mode);
            }
          }
          result.changeState(TaskStatus.QUEUED);
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
                const format1: AudioFormat | undefined =
                  AudioManager.getFileFormat(
                    task.files[0].extension,
                    AppInfo.audioFormats,
                  );
                const format2: AudioFormat | undefined =
                  AudioManager.getFileFormat(
                    entry.files[0].extension,
                    AppInfo.audioFormats,
                  );

                if (!(format1 && format2)) {
                  entry.addFile(task.files[0]);

                  (result as TaskDirectory).entries.splice(v, 1);
                  tasks.splice(v, 1);
                  v--;

                  // TODO change if other than transcript files are needed
                  entry.operations[1].enabled = false;
                  entry.operations[1].changeState(TaskStatus.SKIPPED);
                }
              }
            }

            foundTask = this.state.modes[mode].taskList
              ?.getAllTasks()
              .find((a) => {
                const foundIt = a.files.find((b) => {
                  // console.log(`${result.files[0].name} === ${b.name} && ${a.state}`);
                  return b.name === entry.files[0].name;
                });

                return (
                  a.state === TaskStatus.QUEUED &&
                  !(foundIt === null || foundIt === undefined)
                );
              });

            if (!(foundTask === null || foundTask === undefined)) {
              const format1: AudioFormat | undefined =
                AudioManager.getFileFormat(
                  foundTask.files[0].extension,
                  AppInfo.audioFormats,
                );
              const format2: AudioFormat | undefined =
                AudioManager.getFileFormat(
                  entry.files[0].extension,
                  AppInfo.audioFormats,
                );

              if (!(format1 && format2)) {
                foundTask.setFileObj(0, entry.files[0]);
                foundTask.setFileObj(1, entry.files[1]);

                if (foundTask.files.length > 1) {
                  // TODO change if other than transcript files are needed
                  foundTask.operations[1].enabled = false;
                  foundTask.operations[1].changeState(TaskStatus.SKIPPED);
                }
              } else {
                // TODO check this
              }
            }

            entry.changeState(TaskStatus.QUEUED);
          }
        }

        if (!foundTask) {
          this.addEntry(result, mode, true);
        } else {
          foundTask.fileschange.next();
        }
      }

      if (this.state.modes[mode].preprocessor.queue.length === 0) {
        // check remaining unchecked files
        this.checkFiles(mode);
      }
    };
  };

  private async importTasksFromDB(idbTasks: any[], mode: PortalModeType) {
    let maxTaskCounter = 0;
    let maxOperationCounter = 0;

    for (const taskObj of idbTasks) {
      if (taskObj.type === 'task') {
        if (taskObj.asrLanguage) {
          const firstLangObj = AppSettings.languages.asr.find((a) => {
            return a.value === taskObj.asrLanguage;
          });

          if (firstLangObj) {
            taskObj.asrLanguage = firstLangObj.value;
          }
        }
        const task = Task.fromAny(
          taskObj,
          AppSettings.configuration.api.commands,
          this.state.modes[mode].operations,
        );

        maxTaskCounter = Math.max(maxTaskCounter, task.id);

        for (const operation of task.operations) {
          maxOperationCounter = Math.max(maxOperationCounter, operation.id);

          for (const opResult of operation.results) {
            if (!(opResult.url === null || opResult.url === undefined)) {
              try {
                await this.existsFile(opResult.url);

                opResult.online = true;
                if (opResult.file === null || opResult.file === undefined) {
                  const format: AudioFormat | undefined =
                    AudioManager.getFileFormat(
                      opResult.extension,
                      AppInfo.audioFormats,
                    );

                  if (!format) {
                    try {
                      await opResult.updateContentFromURL(this.httpclient);

                      // TODO minimize task savings
                      await this.storage.saveTask(task, mode);
                    } catch (e) {
                      console.error(e);
                    }
                  }
                }
              } catch (e) {
                opResult.online = false;
              }
            } else {
              opResult.online = false;
            }
          }
        }

        if (!this.state.modes[mode].taskList) {
          throw new Error('taskList not defined');
        }

        this.state.modes[mode].taskList.addEntry(task).catch((err) => {
          console.error(err);
        });
      } else {
        const taskDir = TaskDirectory.fromAny(
          taskObj,
          AppSettings.configuration.api.commands,
          this.state.modes[mode].operations,
        );

        for (const taskElem of taskDir.entries) {
          const task = taskElem as Task;
          for (const operation of task.operations) {
            for (const opResult of operation.results) {
              if (!(opResult.url === null || opResult.url === undefined)) {
                try {
                  opResult.online = true;

                  if (
                    (opResult.file === null || opResult.file === undefined) &&
                    opResult.extension.indexOf('wav') < 0
                  ) {
                    try {
                      opResult.updateContentFromURL(this.httpclient);
                      // TODO minimize task savings
                      await this.storage.saveTask(task, mode);
                    } catch (e) {
                      console.error(e);
                    }
                  }
                } catch (e) {
                  opResult.online = false;
                }
              }
            }
          }
        }

        if (!this.state.modes[mode].taskList) {
          throw new Error('undefined tasklist');
        }
        this.state.modes[mode].taskList.addEntry(taskDir).catch((err) => {
          console.error(err);
        });
      }
    }

    return {
      maxTaskCounter,
      maxOperationCounter,
    };
  }

  public async importDBData(dbEntries: {
    annotationTasks: IDBTaskItem[];
    summarizationTasks: IDBTaskItem[];
    userSettings: IDBUserSettingsItem[];
  }) {
    // TODO filter idbTasks correctly
    const mode = 'annotation';
    this.state.modes.annotation.newfiles = dbEntries.annotationTasks.length > 0;
    this.state.modes.summarization.newfiles =
      dbEntries.summarizationTasks.length > 0;

    // make sure that taskCounter and operation counter are equal to their biggest value
    let maxTaskCounter = 0;
    let maxOperationCounter = 0;

    const annotationTaskResult = await this.importTasksFromDB(
      dbEntries.annotationTasks,
      'annotation',
    );
    const summarizationTaskResult = await this.importTasksFromDB(
      dbEntries.summarizationTasks,
      'summarization',
    );
    maxTaskCounter =
      annotationTaskResult.maxTaskCounter +
      summarizationTaskResult.maxTaskCounter;
    maxOperationCounter =
      annotationTaskResult.maxOperationCounter +
      summarizationTaskResult.maxOperationCounter;

    if (TaskEntry.counter < maxTaskCounter) {
      console.warn(
        `Warning: Task counter was less than the biggest id. Reset counter.`,
      );
      TaskEntry.counter = maxTaskCounter;
    }

    if (Operation.counter < maxOperationCounter) {
      console.warn(
        `Warning: Operation counter was less than the biggest id. Reset counter.`,
      );
      Operation.counter = maxOperationCounter;
    }

    const url = await this.updateProtocolURL();
    if (this.protocolURL) {
      URL.revokeObjectURL(
        (this.protocolURL as any).changingThisBreaksApplicationSecurity,
      );
    }
    this.protocolURL = url;

    if (dbEntries.userSettings) {
      // read userSettings
      for (const userSetting of dbEntries.userSettings) {
        switch (userSetting.name) {
          case 'notification':
            this.notification.permissionGranted = userSetting.value.enabled;
            break;
          case 'defaultTaskOptions':
            // search lang obj
            const lang = AppSettings.getLanguageByCode(
              userSetting.value.asrLanguage,
              userSetting.value.asrProvider,
            );

            if (lang) {
              this.state.modes.annotation.selectedASRLanguage =
                userSetting.value.asrLanguage;
              this.state.modes.annotation.selectedMausLanguage =
                userSetting.value.mausLanguage;
            }
            this.state.modes.annotation.selectedProvider =
              AppSettings.getServiceInformation(userSetting.value.asrProvider);
            break;
        }
      }
      // this.notification.permissionGranted = results[1][]
    }
    this.dbImported.next();
    this.dbImported.complete();
  }

  public checkFiles(mode: PortalModeType) {
    if (this.splitPrompt !== 'BOTH') {
      const removeList = [];
      const promises = [];

      if (!this.state.modes[mode].taskList) {
        throw new Error('undefined tasklist');
      }

      for (const entryElem of this.state.modes[mode].taskList.entries) {
        if (entryElem instanceof TaskDirectory) {
          const entry = entryElem as TaskDirectory;
          if (entry.path.indexOf('_dir') > -1) {
            for (const dirElem of entry.entries) {
              const dirEntry = dirElem as Task;
              let nothingToDo = true;
              // TODO improve this code. Determine the channel file using another way
              if (this.splitPrompt === 'FIRST') {
                if (
                  dirEntry.state === TaskStatus.QUEUED &&
                  dirEntry.files[0].available &&
                  dirEntry.files[0].attributes.originalFileName.indexOf('_2.') >
                    -1
                ) {
                  removeList.push(dirEntry);
                  nothingToDo = false;
                }
              } else if (this.splitPrompt === 'SECOND') {
                if (
                  dirEntry.state === TaskStatus.QUEUED &&
                  dirEntry.files[0].available &&
                  dirEntry.files[0].attributes.originalFileName.indexOf('_1.') >
                    -1
                ) {
                  removeList.push(dirEntry);
                  nothingToDo = false;
                }
              }

              if (nothingToDo) {
                promises.push(
                  this.state.modes[mode].taskList.cleanup(entry, true),
                );
                this.saveCounters();
              }
            }
          }
        }
      }

      for (const removeElement of removeList) {
        promises.push(
          this.state.modes[mode].taskList.removeEntry(removeElement, true),
        );
      }

      Promise.all(promises).catch((error) => {
        console.error(error);
      });
    }
  }

  public addEntry(
    entry: Task | TaskDirectory,
    mode: PortalModeType,
    saveToDB = false,
  ) {
    const taskList = this.state.modes[mode].taskList;
    if (!taskList) {
      throw new Error('undefined tasklist');
    }

    taskList
      .addEntry(entry, saveToDB)
      .then(() => {
        if (!taskList) {
          throw new Error('undefined tasklist');
        }
        return taskList.cleanup(entry, saveToDB);
      })
      .catch((err) => {
        console.error(`${err}`);
      })
      .then(() => {
        this.saveCounters();
      })
      .catch((err) => {
        console.error(`could not add via taskService!`);
        console.error(`${err}`);
      });
  }

  public saveCounters() {
    this.storage.saveCounter('taskCounter', TaskEntry.counter);
    this.storage.saveCounter('operationCounter', Operation.counter);
  }

  public start(mode: PortalModeType) {
    // look for pending tasks
    const taskList = this.state.modes[mode].taskList;
    if (this.state.currentModeState.overallState === 'processing') {
      this.updateStatistics();
      if (!taskList) {
        throw new Error('undefined tasklist');
      }
      const uploadingTask = taskList.getAllTasks().findIndex((task) => {
        return task.operations[0].state === 'UPLOADING';
      });
      if (
        this._statistics.running < this.options.max_running_tasks &&
        uploadingTask < 0
      ) {
        const task: Task | undefined = this.findNextWaitingTask(mode);

        if (task && task.operations[1].providerInformation) {
          if (this.state.currentModeState.status !== TaskStatus.PROCESSING) {
            this.state.currentModeState.changeStatus(TaskStatus.READY);
          }

          task.statechange.subscribe((obj) => {
            this.storage.saveTask(task, mode);

            this.updateProtocolURL().then((url) => {
              if (this.protocolURL) {
                URL.revokeObjectURL(
                  (
                    this.protocolURL as any
                  ).changingThisBreaksApplicationSecurity.toString(),
                );
              }
              this.protocolURL = url;
            });
          });
          this.storage.saveTask(task, mode);
          const asrService = AppSettings.getServiceInformation(
            task.operations[1].providerInformation.provider,
          );
          const langObj = AppSettings.getLanguageByCode(
            task.asrLanguage!,
            task.operations[1].providerInformation.provider,
          );

          if (langObj && asrService) {
            task.start(asrService, langObj, this.httpclient, [
              {
                name: 'GoogleASR',
                value: this._accessCode,
              },
            ]);
          } else {
            console.error('langObj is undefined');
          }
          setTimeout(() => {
            this.start(mode);
          }, 100);
        } else {
          setTimeout(() => {
            this.start(mode);
          }, 100);
        }
      } else {
        setTimeout(() => {
          this.start(mode);
        }, 250);
      }
    }
  }

  public findNextWaitingTask(mode: PortalModeType): Task | undefined {
    const taskList = this.state.modes[mode].taskList;
    if (!taskList) {
      throw new Error('undefined tasklist');
    }
    const tasks = taskList.getAllTasks();
    for (const entry of tasks) {
      if (
        entry.state === TaskStatus.PENDING &&
        ((!(
          entry.files[0].file === null || entry.files[0].file === undefined
        ) &&
          entry.files[0].extension === '.wav') ||
          (entry.operations[0].results.length > 0 &&
            entry.operations[0]?.lastResult?.online))
      ) {
        return entry;
      } else if (entry.state === TaskStatus.READY) {
        for (const operation of entry.operations) {
          if (operation.state !== TaskStatus.SKIPPED && operation.enabled) {
            if (
              (operation.state === TaskStatus.PENDING ||
                operation.state === TaskStatus.READY) &&
              !(operation.name === 'OCTRA' || operation.name === 'Emu WebApp')
            ) {
              return entry;
            } else if (
              operation.state !== TaskStatus.FINISHED &&
              (operation.name === 'OCTRA' || operation.name === 'Emu WebApp')
            ) {
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
      // TODO implement
      /*
      if (!this.taskList) {
        throw new Error('undefined tasklist');
      }
      const promises: Promise<any>[] = [];
      for (const entry of this.taskList.entries) {
        promises.push(entry.toAny());
      }

      Promise.all(promises)
        .then((values) => {
          const json = {
            version: '1.0.0',
            encoding: 'UTF-8',
            created: DateTime.now().toISO(),
            entries: values,
          };

          this.protocolFileName = 'oh_portal_' + Date.now() + '.json';
          const file = new File(
            [JSON.stringify(json, null, 2)],
            this.protocolFileName,
            {
              type: 'text/plain',
            },
          );

          const url = URL.createObjectURL(file);
          resolve(this.sanitizer.bypassSecurityTrustResourceUrl(url));
        })
        .catch((error) => {
          reject(error);
        });
       */
    });
  }

  ngOnDestroy() {
    const tasks = [
      ...(this.state.modes.annotation.taskList?.getAllTasks() ?? []),
      ...(this.state.modes.summarization.taskList?.getAllTasks() ?? []),
    ];

    for (const task of tasks) {
      task.destroy();
    }
    this.subscrmanager.destroy();
  }

  public cleanUpInputArray(
    entries: (FileInfo | DirectoryInfo)[],
  ): (FileInfo | DirectoryInfo)[] {
    let result: (FileInfo | DirectoryInfo)[] = [];

    for (const entry of entries) {
      if (entry instanceof FileInfo) {
        const file = entry as FileInfo;
        const format: AudioFormat | undefined = AudioManager.getFileFormat(
          file.extension,
          AppInfo.audioFormats,
        );

        if (format || this.validTranscript(file.extension)) {
          result.push(file);
        }
      } else {
        const directory = entry as DirectoryInfo;

        const dir = directory.clone();

        dir.entries = dir.entries.filter((a: any) => {
          const format: AudioFormat | undefined = AudioManager.getFileFormat(
            a.extension,
            AppInfo.audioFormats,
          );
          return (
            a instanceof FileInfo &&
            (format || this.validTranscript(a.extension))
          );
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

  public process: (
    queueItem: QueueItem,
    mode: PortalModeType,
  ) => Promise<(Task | TaskDirectory)[]> = async (
    queueItem: QueueItem,
    mode: PortalModeType,
  ) => {
    // TODO define distribution of files to correct modes

    if (queueItem.file instanceof FileInfo) {
      const file = queueItem.file as FileInfo;
      return await this.processFileInfo(file, '', queueItem, mode);
    } else if (queueItem.file instanceof DirectoryInfo) {
      const dir = queueItem.file as DirectoryInfo;
      return this.processDirectoryInfo(dir, queueItem, mode);
    }
    return firstValueFrom(of([]));
  };

  public openSplitModal = () => {};

  public existsFile(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.httpclient.head(url).subscribe({
        next: () => {
          resolve();
        },
        error: (err) => {
          reject(err);
        },
      });
    });
  }

  public validTranscript(extension: string): boolean {
    let result = false;

    for (const converter of AppInfo.converters) {
      for (const extension1 of converter.obj.extensions) {
        result = result || extension1.includes(extension);
      }
    }

    return result;
  }

  public getAppendingsExtension(file: FileInfo): string {
    for (const converter of AppInfo.converters) {
      for (const extension of converter.obj.extensions) {
        if (file.fullname.includes(extension)) {
          return extension;
        }
      }
    }

    return file.extension;
  }

  public toggleProcessing() {
    const mode = this.state.currentMode;
    this.state.currentModeState.overallState =
      this.state.currentModeState.overallState === 'processing'
        ? 'stopped'
        : 'processing';
    if (!this.state.modes[mode].taskList) {
      throw new Error('undefined tasklist');
    }
    const tasks = this.state.modes[mode].taskList.getAllTasks();
    if (this.state.currentModeState.overallState === 'processing') {
      for (const task of tasks) {
        task.resumeTask();
      }

      this.start(mode);
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
      errors: 0,
    };
    const allTasks = [
      ...(this.state.modes.annotation.taskList?.getAllTasks() ?? []),
      ...(this.state.modes.summarization.taskList?.getAllTasks() ?? []),
    ];

    for (const task of allTasks) {
      // running
      if (
        task.state === TaskStatus.PROCESSING ||
        task.state === TaskStatus.UPLOADING
      ) {
        result.running++;
      }

      // waiting
      if (
        task.state === TaskStatus.PENDING ||
        task.state === TaskStatus.READY
      ) {
        result.waiting++;
      }

      // queued
      if (task.state === TaskStatus.QUEUED) {
        result.queued++;
      }

      // finished
      if (task.state === TaskStatus.FINISHED) {
        result.finished++;
      }

      // failed
      if (task.state === TaskStatus.ERROR) {
        result.errors++;
      }
    }

    this._statistics = result;
  }

  private listenToTaskEvents(task: Task, mode: PortalModeType) {
    this.subscrmanager.add(
      task.opstatechange.subscribe((event) => {
        const operation = task.getOperationByID(event.opID);
        if (!operation) {
          return;
        }
        const opName = operation.name;
        const fileName = (
          task.files[0].attributes?.originalFileName ?? task.files[0].fullname
        ).replace(/\.[^.]+$/g, '');

        if (opName === 'ASR' && event.newState === TaskStatus.FINISHED) {
          this.notification.showNotification(
            `"${operation.title}" successful`,
            `You can now transcribe ${fileName} manually.`,
          );
        } else if (event.newState === TaskStatus.ERROR) {
          this.notification.showNotification(
            '"' + operation.title + '" Operation failed',
            `Operation failed for ${fileName}.
 For more information hover over the red "X" icon.`,
          );
        } else if (
          opName === 'MAUS' &&
          event.newState === TaskStatus.FINISHED
        ) {
          this.notification.showNotification(
            `"${operation.title}" successful`,
            `You can now open phonetic
  details of ${fileName}.`,
          );
        }

        this.updateStatistics();
        const lastOp = task.operations[task.operations.length - 1];
        if (
          this._statistics.running > 1 ||
          (this._statistics.running === 1 &&
            lastOp.state !== TaskStatus.FINISHED &&
            lastOp.state !== TaskStatus.READY)
        ) {
          if (operation.state === TaskStatus.UPLOADING) {
            this.state.modes[mode].changeStatus(TaskStatus.UPLOADING);
          } else {
            this.state.modes[mode].changeStatus(TaskStatus.PROCESSING);
          }
        } else {
          this.state.modes[mode].changeStatus(TaskStatus.READY);
        }
        this.storage.saveTask(task, mode);

        this.updateProtocolURL().then((url) => {
          if (this.protocolURL) {
            URL.revokeObjectURL(
              (
                this.protocolURL as any
              ).changingThisBreaksApplicationSecurity.toString(),
            );
          }
          this.protocolURL = url;
        });
      }),
    );
  }

  private async processFileInfo(
    file: FileInfo,
    path: string,
    queueItem: QueueItem,
    mode: PortalModeType,
  ): Promise<(Task | TaskDirectory)[]> {
    if (!file?.file) {
      throw new Error('file is undefined');
    }

    file.hash = await this.state.modes[mode].preprocessor.getHashString(
      file.file,
    );
    const hashString =
      file.hash.length === 64 ? file.hash.slice(-20) : file.hash;
    const newName = `${hashString}${file.extension}`;
    let newFileInfo: FileInfo | undefined;
    this.state.currentModeState.newfiles = true;

    if (newName !== file.fullname) {
      // no valid name, replace
      const newfile = await FileInfo.renameFile(file.file, newName, {
        type: file.type,
        lastModified: file.file.lastModified,
      });
      newFileInfo = new FileInfo(
        newfile.name,
        file.type,
        newfile.size,
        newfile,
      );
      newFileInfo.attributes = queueItem.file.attributes;
      newFileInfo.attributes.originalFileName = file.fullname;
      newFileInfo.hash = file.hash;
      file = newFileInfo;
    } else {
      newFileInfo = new FileInfo(
        file.fullname,
        file.type !== '' ? file.type : file.file.type,
        file.size,
        file.file,
      );
      newFileInfo.attributes = queueItem.file.attributes;
      newFileInfo.attributes.originalFileName = file.fullname;
      newFileInfo.hash = file.hash;
      newFileInfo.attributes.originalFileName = file.fullname;
      file = newFileInfo;
    }

    if (!file?.file) {
      throw new Error('file is undefined');
    }
    if (!file?.hash) {
      throw new Error('hash is undefined');
    }

    const foundOldFile = this.getTaskWithHashAndName(
      file.hash,
      file.attributes.originalFileName,
      mode,
    );

    if (file?.file) {
      const arrayBuffer = await readFileAsArray(file.file);
      const format: AudioFormat | undefined = AudioManager.getFileFormat(
        file.extension,
        AppInfo.audioFormats,
      );
      const isValidTranscript = this.validTranscript(file.extension);

      if (format && !isValidTranscript) {
        // it's an audio file
        await format.init(file.fullname, file.type, arrayBuffer);
        const audioInfo = getAudioInfo(
          format,
          file.fullname,
          file.type,
          arrayBuffer,
        );

        if (audioInfo.channels > 1) {
          const directory = new DirectoryInfo(
            path +
              file.attributes.originalFileName.replace(/\..+$/g, '') +
              '_dir/',
          );
          const cutter = new AudioCutter(audioInfo);
          const files: File[] = await cutter.splitChannelsToFiles(
            file.attributes.originalFileName,
            [0, 1],
            arrayBuffer,
          );
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
              fileInfo.attributes.originalFileName = `${file.attributes.originalFileName.replace(
                /\..+$/g,
                '',
              )}_${i + 1}.${file.extension}`;
              fileInfos.push(fileInfo);
            }
            directory.addEntries(fileInfos);
            const result = await this.processDirectoryInfo(
              directory,
              queueItem,
              mode,
            );
            return result;
          } else {
            return this.processFileInfo(
              FileInfo.fromFileObject(files[0]),
              path,
              queueItem,
              mode,
            );
          }
        } else {
          // it's an audio file
          newFileInfo = new AudioInfo(
            newName,
            file.file.type,
            file.file.size,
            format.sampleRate,
            audioInfo.duration.samples,
            audioInfo.channels,
            audioInfo.bitrate,
          );
          newFileInfo.hash = file.hash;
        }
      } else if (file.type.includes('audio')) {
        this.alertService.showAlert(
          'danger',
          `The audio file '${file.fullname}' is invalid.
              Only Wave (*.wav) files with 16 Bit signed Int are supported.`,
          -1,
        );
        throw new Error('no valid wave format!');
      }

      if (newFileInfo) {
        if (newFileInfo.file === null || newFileInfo.file === undefined) {
          newFileInfo.file = file.file;
        }

        newFileInfo.attributes = {
          ...file.attributes,
        };

        // new file
        const task = new Task([newFileInfo], this.state.modes[mode].operations);
        task.asrLanguage = this.state.currentModeState.selectedASRLanguage;
        task.asrProvider =
          this.state.currentModeState.selectedProvider?.provider;

        // set state
        for (let i = 0; i < this.state.modes[mode].operations.length; i++) {
          const operation = this.state.modes[mode].operations[i];
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

  private async processDirectoryInfo(
    dir: DirectoryInfo,
    queueItem: QueueItem,
    mode: PortalModeType,
  ): Promise<TaskDirectory[]> {
    const dirTask = new TaskDirectory(dir.path, dir.size);
    const processedValues: any = [];

    for (const dirEntry of dir.entries) {
      if (dirEntry instanceof FileInfo) {
        const file = dirEntry as FileInfo;
        processedValues.push(
          await this.processFileInfo(file, dir.path, queueItem, mode),
        );
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
        for (let i = 0; i < this.state.modes[mode].operations.length; i++) {
          const operation = this.state.modes[mode].operations[i];
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

  private getTaskWithHashAndName(
    hash: string,
    name: string,
    mode: PortalModeType,
  ): Task | undefined {
    const taskList = this.state.modes[mode].taskList;
    if (!taskList) {
      throw new Error('undefined tasklist');
    }

    const tasks: Task[] = taskList.getAllTasks();

    for (const task of tasks) {
      if (
        !(
          task.files[0].attributes.originalFileName === null ||
          task.files[0].attributes.originalFileName === undefined
        )
      ) {
        for (const file of task.files) {
          const cmpHash = file.hash ?? `${file.name}_${file.size}`;
          // console.log(`${cmpHash} === ${hash}`);
          if (
            cmpHash === hash &&
            file.attributes.originalFileName === name &&
            (task.operations[0].state === TaskStatus.PENDING ||
              task.operations[0].state === TaskStatus.ERROR)
          ) {
            return task;
          }
        }
      } else {
        console.error('could not find originalFilename');
      }
    }

    return undefined;
  }

  private getTaskWithOriginalFileName(
    regex: RegExp,
    mode: PortalModeType,
  ): Task | undefined {
    const taskList = this.state.modes[mode].taskList;
    if (!taskList) {
      throw new Error('undefined tasklist');
    }

    const tasks: Task[] = taskList.getAllTasks();

    for (const task of tasks) {
      if (task.files[0].attributes.originalFileName) {
        for (const file of task.files) {
          // console.log(`${cmpHash} === ${hash}`);
          if (
            (task.operations[0].state === TaskStatus.PENDING ||
              task.operations[0].state === TaskStatus.QUEUED ||
              task.operations[0].state === TaskStatus.ERROR) &&
            regex.exec(file.attributes.originalFileName) !== null
          ) {
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
