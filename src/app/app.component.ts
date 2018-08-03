import {HttpClient} from '@angular/common/http';
import {Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {isArray, isNullOrUndefined} from 'util';
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
import {ToolLoaderComponent} from './components/tool-loader/tool-loader.component';
import {AlertService} from './shared/alert.service';
import {UploadOperation} from './obj/tasks/upload-operation';
import * as X2JS from 'x2js';
import {StatisticsModalComponent} from './modals/statistics-modal/statistics-modal.component';

declare var window: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [],
  animations: [ANIMATIONS]
})
export class AppComponent implements OnDestroy {
  get showtool(): boolean {
    return this._showtool;
  }

  set showtool(value: boolean) {
    this.sidebarExpand = (value) ? 'closed' : 'opened';
    this._showtool = value;
  }

  private _showtool = false;
  public sidebarstate = 'hidden';
  public tool_url: SafeResourceUrl;
  private firstModalShown = false;
  isCollapsed = true;

  public allTasks(): Task[] {
    if (!isNullOrUndefined(this.taskService.taskList)) {
      return this.taskService.taskList.getAllTasks();
    }

    return [];
  }

  public get isdevelopment(): boolean {
    return environment.development;
  }

  public get toolSelectedOperation(): Operation {
    return this.proceedings.toolSelectedOperation;
  }

  public set toolSelectedOperation(value: Operation) {
    this.proceedings.toolSelectedOperation = value;
  }

  public test = 'inactive';
  public sidebarExpand = 'opened';
  private blockLeaving = true;
  private subscrmanager = new SubscriptionManager();
  public dragborder = 'inactive';
  public newProceedingsWidth = 30;
  public newToolWidth = 70;

  public get animationObject(): any {
    const width = 100 - this.newProceedingsWidth;
    return {value: this.sidebarExpand, params: {toolWidth: width, procWidth: this.newProceedingsWidth}}
  }

  public get animationObject2(): any {
    const width = this.newProceedingsWidth;
    return {value: this.sidebarExpand, params: {width: width}}
  }

  @ViewChild('fileinput') fileinput: ElementRef;
  @ViewChild('folderinput') folderinput: ElementRef;
  @ViewChild('proceedings') proceedings: ProceedingsComponent;
  @ViewChild('splitModal') splitModal: SplitModalComponent;
  @ViewChild('firstModal') firstModal: FirstModalComponent;
  @ViewChild('feedbackModal') feedbackModal: FeedbackModalComponent;
  @ViewChild('queueModal') queueModal: QueueModalComponent;
  @ViewChild('protocolFooter') protocolFooter: ProtocolFooterComponent;
  @ViewChild('toolLoader') toolLoader: ToolLoaderComponent;
  @ViewChild('statisticsModal') statisticsModal: StatisticsModalComponent;

  constructor(public taskService: TaskService, private sanitizer: DomSanitizer,
              private httpclient: HttpClient, public notification: NotificationService,
              private storage: StorageService,
              public bugService: BugReportService,
              private alertService: AlertService
  ) {
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

    this.subscrmanager.add(this.storage.allloaded.subscribe((results) => {
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

      if (!isNullOrUndefined(results[1])) {
        // read userSettings
        for (let i = 0; i < results[1].length; i++) {
          const userSetting = results[1][i];

          switch (userSetting.name) {
            case ('sidebarWidth'):
              this.newProceedingsWidth = userSetting.value;
              break;
          }
        }
        // this.notification.permissionGranted = results[1][]
      }
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
    console.log(`operation click!`);
    if (operation instanceof ToolOperation) {
      const tool = <ToolOperation> operation;

      if ((tool.task.operations[0].results.length > 0 && !tool.task.operations[0].lastResult.available) || (!isNullOrUndefined(tool.previousOperation) && tool.previousOperation.results.length > 0 && !tool.previousOperation.lastResult.available)) {
        if (!tool.task.operations[0].results[0].available) {

          if (isNullOrUndefined(tool.task.files[0].file)) {
            this.alertService.showAlert('warning',
              `Please add the audio file "${tool.task.operations[0].results[0].fullname}" and run "${tool.name}" again.`, 10);
            tool.task.operations[0].changeState(TaskState.PENDING);
            tool.task.changeState(TaskState.PENDING);
          } else {
            // start upload process
            this.alertService.showAlert('info', `Please wait until file ${tool.task.files[0].fullname} being uploaded and run '${tool.name}' again.`);
            tool.task.operations[0].statechange.subscribe(
              (state) => {
                if (state.newState === 'FINISHED') {
                  this.alertService.showAlert('success', `file ${tool.task.files[0].fullname} successfully uploaded. You can now run '${tool.name}' for this file.`);
                  this.storage.saveTask(tool.task);
                }
              },
              (error) => {
                console.error(error);
              }
            );
            this.taskService.start();
          }
        } else if (tool.task.operations[0].lastResult.available && !tool.previousOperation.lastResult.available) {
          this.alertService.showAlert('info',
            `Please run ${tool.previousOperation.name} for this task again.`, 12);
        }
      } else {
        new Promise<void>((resolve, reject) => {
          // check if tool results exist
          if (tool.results.length > 0 && !tool.lastResult.online && tool.lastResult.available) {
            // reupload result from tool operation

            // TODO make uploading easier!
            const langObj = AppInfo.getLanguageByCode(tool.task.language);
            const url = `${langObj.host}uploadFileMulti`;

            const subj = UploadOperation.upload([tool.lastResult], url, this.httpclient);
            subj.subscribe((obj) => {
              if (obj.type === 'loadend') {
                const result = <string> obj.result;
                const x2js = new X2JS();
                let json: any = x2js.xml2js(result);
                json = json.UploadFileMultiResponse;


                // add messages to protocol
                if (json.warnings !== '') {
                  console.warn(json.warnings);
                }

                if (json.success === 'true') {
                  // TODO set urls to results only
                  if (isArray(json.fileList.entry)) {
                    tool.lastResult.url = json.fileList.entry[0].value;
                  } else {
                    // json attribute entry is an object
                    tool.lastResult.url = json.fileList.entry['value'];
                  }
                  this.storage.saveTask(tool.task);
                  resolve();
                } else {
                  reject(json['message']);
                }
              }
            }, (err) => {
              reject(err);
            });
          } else if (!isNullOrUndefined(tool.previousOperation.lastResult) && !tool.previousOperation.lastResult.online && tool.previousOperation.lastResult.available) {
            // reupload result from previous operation
            // local available, re upload

            // TODO make using upload easier!
            const langObj = AppInfo.getLanguageByCode(tool.task.language);
            const url = `${langObj.host}uploadFileMulti`;

            const subj = UploadOperation.upload([tool.previousOperation.lastResult], url, this.httpclient);
            subj.subscribe((obj) => {
              if (obj.type === 'loadend') {
                const result = <string> obj.result;
                const x2js = new X2JS();
                let json: any = x2js.xml2js(result);
                json = json.UploadFileMultiResponse;


                // add messages to protocol
                if (json.warnings !== '') {
                  console.warn(json.warnings);
                }

                if (json.success === 'true') {
                  // TODO set urls to results only
                  if (isArray(json.fileList.entry)) {
                    tool.previousOperation.lastResult.url = json.fileList.entry[0].value;
                  } else {
                    // json attribute entry is an object
                    tool.previousOperation.lastResult.url = json.fileList.entry['value'];
                  }
                  this.storage.saveTask(tool.task);
                  resolve();
                } else {
                  reject(json['message']);
                }
              }
            }, (err) => {
              reject(err);
            });
          } else {
            resolve();
          }
        }).then(() => {
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

          if (this.tool_url !== '') {
            this.toolLoader.url = tool.getToolURL();
            if (!isNullOrUndefined(this.toolSelectedOperation) && operation.id !== this.toolSelectedOperation.id) {
              // some operation already initialized
              this.leaveToolOption();
            }

            this.toolSelectedOperation = operation;
            this.sidebarstate = 'opened';

            this.showtool = true;
            if (operation instanceof OCTRAOperation) {
              operation.time.start = Date.now();
            }
          } else {
            console.warn(`tool url is empty`);
          }
        }).catch((error) => {
          console.error(error);
        });
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
      const file = FileInfo.fromURL(result, null, 'text/plain');
      file.updateContentFromURL(this.httpclient).then(() => {
        this.toolSelectedOperation.results.push(file);

        const index = this.toolSelectedOperation.task.operations.findIndex((op) => {
          if (op.id === this.toolSelectedOperation.id) {
            return true;
          }
        });

        // reset next operations
        if (index > -1) {
          for (let i = index + 1; i < this.toolSelectedOperation.task.operations.length; i++) {
            const operation = this.toolSelectedOperation.task.operations[i];
            operation.changeState(TaskState.PENDING);
          }
        }

        if (this.toolSelectedOperation instanceof OCTRAOperation) {
          this.toolSelectedOperation.time.duration += Date.now() - this.toolSelectedOperation.time.start;
        }

        this.toolSelectedOperation.changeState(TaskState.FINISHED);
        this.storage.saveTask(this.toolSelectedOperation.task);

        setTimeout(() => {
          this.toolSelectedOperation.task.restart(this.httpclient);
          this.onBackButtonClicked();
        }, 1000);
      }).catch((error) => {
        console.error(error);
      });
    }
  }

  onBackButtonClicked() {
    this.showtool = false;
    this.sidebarstate = 'hidden';
    this.leaveToolOption();
  }

  leaveToolOption() {
    if (!isNullOrUndefined(this.toolSelectedOperation.nextOperation)
      && this.toolSelectedOperation.nextOperation.state === TaskState.FINISHED) {
      this.toolSelectedOperation.changeState(TaskState.FINISHED);
    } else if (this.toolSelectedOperation.state !== TaskState.FINISHED) {
      this.toolSelectedOperation.changeState(TaskState.READY);
    }
    this.toolSelectedOperation = undefined;
    console.log(`toolSelect to undefined`);
  }

  @HostListener('window:beforeunload', ['$event'])
  doSomething($event) {
    $event.returnValue = this.blockLeaving;
  }

  public getTime(): number {
    let elem: AudioInfo = <AudioInfo> this.toolSelectedOperation.task.files[0];

    if (!isNullOrUndefined(elem.duration)) {
      return elem.duration.unix;
    }

    return 0;
  }

  public openSplitModal = () => {
    this.splitModal.open((reason) => {
      this.taskService.splitPrompt = reason;
      this.taskService.checkFiles();
    });
  };


  public dragBorder($event: any, part: string) {
    if ($event.type === 'mousemove' || $event.type === 'mouseenter' || $event.type === 'mouseleave') {
      if (this.dragborder !== 'dragging') {
        if (part === 'left' && $event.pageX >= $event.target.clientWidth - 3 && $event.pageX <= $event.target.clientWidth + 3) {
          this.dragborder = 'active';
        } else if (part === 'right' && $event.pageX <= 10) {
          this.dragborder = 'active';
        } else {
          this.dragborder = 'inactive';
        }
      } else if ($event.type === 'mousemove') {
        // dragging
        const procWidth = Math.floor(($event.pageX + 10) / window.innerWidth * 100);
        const toolWidth = 100 - procWidth;

        this.newToolWidth = toolWidth;
        this.newProceedingsWidth = procWidth;
        this.storage.saveUserSettings('sidebarWidth', this.newProceedingsWidth);
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

  resetSideBarWidth() {
    this.newProceedingsWidth = 30;
    this.newToolWidth = 70;
    this.storage.saveUserSettings('sidebarWidth', this.newProceedingsWidth);
  }

  public onClearClick() {
    this.storage.clearAll();
  }
}
