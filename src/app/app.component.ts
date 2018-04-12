import {HttpClient} from '@angular/common/http';
import {Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {environment} from '../environments/environment';
import {AppInfo} from './app.info';
import {ANIMATIONS} from './shared/Animations';
import {NotificationService} from './shared/notification.service';
import {SubscriptionManager} from './shared/subscription-manager';
import {Task, TaskState} from './obj/tasks';
import {AudioInfo} from './obj/audio';
import {ProceedingsComponent} from './components/proceedings/proceedings.component';
import {TaskService} from './obj/tasks/task.service';
import {DirectoryInfo} from './obj/directoryInfo';
import {TaskDirectory} from './obj/tasks/';
import {StorageService} from './storage.service';
import {FileInfo} from './obj/fileInfo';
import {ToolOperation} from './obj/tasks/tool-operation';
import {Operation} from './obj/tasks/operation';
import {OCTRAOperation} from './obj/tasks/octra-operation';
import {FeedbackModalComponent} from './modals/feedback-modal/feedback-modal.component';
import {BugReportService, ConsoleType} from './shared/bug-report.service';
import {SplitModalComponent} from './modals/split-modal/split-modal.component';
import {FirstModalComponent} from './modals/first-modal/first-modal.component';
import {QueueModalComponent} from './modals/queue-modal/queue-modal.component';
import {ProtocolFooterComponent} from './components/protocol-footer/protocol-footer.component';

declare var window: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [],
  animations: [ANIMATIONS]
})
export class AppComponent implements OnDestroy {
  set showtool(value: boolean) {
    this.sidebarExpand = (value) ? 'closed' : 'opened';
    this._showtool = value;
  }

  private _showtool = false;
  public sidebarstate = 'hidden';
  public tool_url: SafeResourceUrl;
  public selectedOperation: Operation = null;
  private firstModalShown = false;


  public get isdevelopment(): boolean {
    return environment.development;
  }

  public test = 'inactive';
  public sidebarExpand = 'opened';
  private blockLeaving = true;
  private subscrmanager = new SubscriptionManager();
  public protocolURL = '';
  public dragborder = 'inactive';
  public newProceedingsWidth = '100%';
  public newToolWidth = '70%';

  @ViewChild('fileinput') fileinput: ElementRef;
  @ViewChild('folderinput') folderinput: ElementRef;
  @ViewChild('proceedings') proceedings: ProceedingsComponent;
  @ViewChild('splitModal') splitModal: SplitModalComponent;
  @ViewChild('firstModal') firstModal: FirstModalComponent;
  @ViewChild('feedbackModal') feedbackModal: FeedbackModalComponent;
  @ViewChild('queueModal') queueModal: QueueModalComponent;
  @ViewChild('protocolFooter') protocolFooter: ProtocolFooterComponent;

  constructor(public taskService: TaskService, private sanitizer: DomSanitizer,
              private httpclient: HttpClient, public notification: NotificationService,
              private storage: StorageService,
              public bugService: BugReportService) {

    const debugging = false;
    if (!debugging) {
      // overwrite console.log
      const oldLog = console.log;
      const serv = this.bugService;
      (() => {
        console.log = function (message) {
          serv.addEntry(ConsoleType.LOG, message);
          oldLog.apply(console, arguments);
        };
      })();

      // overwrite console.err
      const oldError = console.error;
      (() => {
        console.error = function (message) {
          serv.addEntry(ConsoleType.ERROR, message);
          oldError.apply(console, arguments);
        };
      })();

      // overwrite console.info
      const oldInfo = console.info;
      (() => {
        console.info = function (message) {
          serv.addEntry(ConsoleType.INFO, message);
          oldInfo.apply(console, arguments);
        };
      })();

      // overwrite console.warn
      const oldWarn = console.warn;
      (() => {
        console.warn = function (message) {
          serv.addEntry(ConsoleType.WARN, message);
          oldWarn.apply(console, arguments);
        };
      })();
    }

    this.subscrmanager.add(this.notification.onPermissionChange.subscribe(
      (result) => {
        if (this.storage.ready) {
          this.storage.saveUserSettings('notification', {
            enabled: result
          });
        }
      }
    ));

    this.subscrmanager.add(this.taskService.errorscountchange.subscribe(
      () => {
        this.protocolFooter.blop();
      }
    ));

    this.subscrmanager.add(this.storage.allloaded.subscribe(() => {
      this.storage.getIntern('firstModalShown').then(
        (result) => {
          if (!isNullOrUndefined(result)) {
            this.firstModalShown = result.value;
          }
          this.loadFirstModal();
        }
      ).catch((err) => {
        console.error(err);
        this.loadFirstModal();
      });
    }));

    window.onunload = function () {
      return false;
    };

    this.taskService.openSplitModal = this.openSplitModal;
  }


  private loadFirstModal() {
    if (!this.firstModalShown) {

      this.subscrmanager.add(this.firstModal.onUnderstandClick.subscribe(
        () => {
          this.firstModalShown = true;
        }
      ));
      setTimeout(() => {
        this.firstModal.open(() => {
          console.log(`firstModalShown = ${this.firstModalShown}`);
          return this.firstModalShown;
        }, () => {
          this.storage.saveIntern('firstModalShown', true);
        });
      }, 1000);
    }
  }

  public get AppInfo() {
    return AppInfo;
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  onAfterDrop(entries: (FileInfo | DirectoryInfo)[]) {
    this.readNewFiles(entries);
  }

  private readNewFiles(entries: (FileInfo | DirectoryInfo)[]) {
    if (!isNullOrUndefined(entries) && !isNullOrUndefined(this.taskService.operations)) {
      console.log('entries:');
      console.log(entries);
      // filter and re-structure entries array to supported files and directories
      let filteredEntries = this.taskService.cleanUpInputArray(entries);

      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];

        this.taskService.preprocessor.addToQueue(entry);
      }
    }
  }

  onUploadButtonClick() {
    new Promise<void>((resolve, reject) => {
        const tasks = this.taskService.taskList.getAllTasks().filter((a) => {
          return a.state === TaskState.QUEUED;
        });

        if (tasks.length > 0) {
          this.queueModal.open(null, () => {
            resolve();
          });
        } else {
          resolve();
        }
      }
    ).then(() => {
      // start first operation of this task
      this.taskService.start();
    });
  }

  onMissedDrop(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  onFilesAddButtonClicked() {
    this.fileinput.nativeElement.click();
  }

  onFoldersAddButtonClicked() {
    this.folderinput.nativeElement.click();
  }

  onFileChange($event) {
    const files: FileList = $event.target.files;
    const test = $event.target.items;
    const file_infos: FileInfo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file: File = files[i];
      file_infos.push(new FileInfo(file.name, file.type, file.size, file));
    }

    this.readNewFiles(file_infos);
  }

  onOperationClick(operation: Operation) {
    if (operation instanceof ToolOperation) {
      const tool = <ToolOperation> operation;
      const index = tool.task.operations.findIndex((op) => {
        if (op.id === tool.id) {
          return true;
        }
      });

      if (index < tool.task.operations.length - 1) {
        // start processing
        tool.changeState(TaskState.PROCESSING);
      }

      this.tool_url = tool.getToolURL();

      if (!isNullOrUndefined(this.selectedOperation) && operation.id !== this.selectedOperation.id) {
        // some operation already initialized
        this.leaveToolOption();
      }

      this.selectedOperation = operation;
      this.sidebarstate = 'opened';

      this.showtool = true;
      if (operation instanceof OCTRAOperation) {
        operation.time.start = Date.now();
      }
    }
  }

  onOperationHover(operation: Operation) {
  }

  onASRLangCHanged(lang) {
    if (lang.code !== this.taskService.selectedlanguage.code) {
      this.taskService.selectedlanguage = lang;
      this.changeLanguageforAllQueuedTasks();
      this.storage.saveUserSettings('defaultTaskOptions', {
        language: lang.code
      });
    }
  }

  changeLanguageforAllQueuedTasks() {
    let tasks = this.taskService.taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.state === TaskState.QUEUED) {
        task.language = this.taskService.selectedlanguage.code;
        this.storage.saveTask(task);
      }
    }
  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }

  onToolDataReceived($event) {
    if ($event.data.data !== undefined && $event.data.hasOwnProperty('data') && $event.data.data.hasOwnProperty('transcript_url')) {
      const result: string = $event.data.data.transcript_url;

      this.selectedOperation.results.push(FileInfo.fromURL(result));

      const index = this.selectedOperation.task.operations.findIndex((op) => {
        if (op.id === this.selectedOperation.id) {
          return true;
        }
      });

      let startedBefore = false;
      // reset next operations
      if (index > -1) {
        for (let i = index + 1; i < this.selectedOperation.task.operations.length; i++) {
          const operation = this.selectedOperation.task.operations[i];
          if (operation.state !== TaskState.PENDING) {
            startedBefore = true;
          }
          operation.changeState(TaskState.PENDING);
        }
      } else {
        console.error(`index is ${index}`);
      }

      if (this.selectedOperation instanceof OCTRAOperation) {
        this.selectedOperation.time.duration += Date.now() - this.selectedOperation.time.start;
      }

      this.selectedOperation.changeState(TaskState.FINISHED);
      this.storage.saveTask(this.selectedOperation.task);
      if (startedBefore) {
        setTimeout(() => {
          this.selectedOperation.task.restart(this.httpclient);
          this.onBackButtonClicked();
        }, 1000);
      } else {

        this.onBackButtonClicked();
      }
    }
  }

  onBackButtonClicked() {
    this.showtool = false;
    this.sidebarstate = 'hidden';
    this.leaveToolOption();
  }

  leaveToolOption() {
    if (!isNullOrUndefined(this.selectedOperation.nextOperation)) {
      if (this.selectedOperation.nextOperation.state === TaskState.FINISHED) {
        this.selectedOperation.changeState(TaskState.FINISHED);
      }
    } else {
      this.selectedOperation.changeState(TaskState.READY);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  doSomething($event) {
    $event.returnValue = this.blockLeaving;
  }

  public getTime(): number {
    let elem: AudioInfo = <AudioInfo> this.selectedOperation.task.files[0];

    if (!isNullOrUndefined(elem.duration)) {
      return elem.duration.unix;
    }

    return 0;
  }

  public openSplitModal = () => {
    this.splitModal.open((reason) => {
      this.taskService.splitPrompt = reason;
      this.checkFiles();
    });
  };

  public checkFiles() {
    if (this.taskService.splitPrompt !== 'BOTH') {
      for (let i = 0; i < this.taskService.taskList.entries.length; i++) {
        let entry = this.taskService.taskList.entries[i];

        if (entry instanceof TaskDirectory) {
          entry = <TaskDirectory> entry;
          if (entry.path.indexOf('_dir') > -1) {
            for (let j = 0; j < entry.entries.length; j++) {
              const dirEntry = <Task> entry.entries[j];

              // TODO improve this code. Determine the channel file using another way
              if (this.taskService.splitPrompt === 'FIRST') {
                if (dirEntry.files[0].fullname.indexOf('_2.') > -1) {
                  entry.entries.splice(j, 1);
                  j--;
                }
              } else if (this.taskService.splitPrompt === 'SECOND') {
                if (dirEntry.files[0].fullname.indexOf('_1.') > -1) {
                  entry.entries.splice(j, 1);
                  j--;
                }
              }
            }
            this.storage.saveTask(entry).catch((err) => {
              console.error(err);
            });
          }

          if (entry.entries.length === 1) {
            // only one item
            let path = entry.path.substr(0, entry.path.lastIndexOf('/'));
            path = path.substr(0, path.lastIndexOf('/')) + '/';
            let dirtemp = this.taskService.taskList.findTaskDirByPath(path);

            if (!isNullOrUndefined(dirtemp)) {
              dirtemp.entries.push(entry.entries[0]);
              const entr = entry.entries[0];
              this.storage.saveTask(dirtemp).catch((err) => {
                console.error(err);
              });
              this.storage.removeFromDB(entry).then(() => {
                this.taskService.taskList.removeDir(<TaskDirectory> entry);

              }).catch((err) => {
                console.error(err);
              });
            } else if (path !== '' && path !== '/') {
              dirtemp = new TaskDirectory(path);
              this.storage.removeFromDB(entry).then(() => {
                this.taskService.taskList.removeDir(<TaskDirectory> entry);
              }).catch((error) => {
                  console.error(error);
                }
              );
              dirtemp.addEntries(entry.entries);
              this.taskService.taskList.addEntry(dirtemp);
              this.storage.saveTask(dirtemp).catch((err) => {
                console.error(err);
              });
            } else {
              const entries = this.taskService.taskList.entries[i];
              this.storage.removeFromDB(entries).then(() => {
                this.taskService.taskList.entries[i] = (<TaskDirectory> entries).entries[0];

                const entr = <Task> this.taskService.taskList.entries[i];
                entr.directory = null;
                this.storage.saveTask(entr).then(() => {
                }).catch((err) => {
                  console.error(err);
                });
              }).catch((err) => {
                console.error(err);
              });
            }
          } else if (entry.entries.length < 1) {
            // empty dir
            this.storage.removeFromDB(entry).then(() => {
              this.taskService.taskList.removeDir(<TaskDirectory> entry);
            }).catch((error) => {
                console.error(error);
              }
            );
          }
        }
      }
    }
  }


  public dragBorder($event: any, part: string) {
    if ($event.type === 'mousemove' || $event.type === 'mouseenter' || $event.type === 'mouseleave') {
      if (this.dragborder !== 'dragging') {
        if (part === 'left' && $event.offsetX >= $event.target.clientWidth - 3 && $event.offsetX <= $event.target.clientWidth + 3) {
          this.dragborder = 'active';
        } else if (part === 'right' && $event.offsetX <= 10) {
          this.dragborder = 'active';
        } else {
          this.dragborder = 'inactive';
        }
      } else if ($event.type === 'mousemove') {
        // dragging
        const procWidth = Math.floor(($event.pageX + 10) / window.innerWidth * 100);
        const toolWidth = 100 - procWidth;

        this.newToolWidth = toolWidth + '%';
        this.newProceedingsWidth = procWidth + '%';
      }
    }

    if (this.dragborder === 'dragging' && $event.type === 'mouseleave') {
      $event.preventDefault();
    }

    switch ($event.type) {
      case ('mousedown'):
        if (this.dragborder === 'active') {
          this.dragborder = 'dragging';
        }
        break;
      case ('mouseup'):
        this.dragborder = 'inactive';
        break;
    }
  }

  public onBlur($event) {
    if (this.dragborder === 'dragging') {
      $event.preventDefault();
    }
  }
}
