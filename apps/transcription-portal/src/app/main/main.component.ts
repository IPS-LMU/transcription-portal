import {HttpClient} from '@angular/common/http';
import {ChangeDetectorRef, Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {environment} from '../../environments/environment';
import {AppInfo} from '../app.info';
import {ANIMATIONS} from '../shared/Animations';
import {NotificationService} from '../shared/notification.service';
import {SubscriptionManager} from '../shared/subscription-manager';
import {Task, TaskState} from '../obj/tasks';
import {AudioInfo} from '@octra/media';
import {ProceedingsComponent} from '../components/proceedings/proceedings.component';
import {TaskService} from '../obj/tasks/task.service';
import {StorageService} from '../storage.service';
import {ToolOperation} from '../obj/operations/tool-operation';
import {Operation} from '../obj/operations/operation';
import {OCTRAOperation} from '../obj/operations/octra-operation';
import {FeedbackModalComponent} from '../modals/feedback-modal/feedback-modal.component';
import {BugReportService, ConsoleType} from '../shared/bug-report.service';
import {SplitModalComponent} from '../modals/split-modal/split-modal.component';
import {FirstModalComponent} from '../modals/first-modal/first-modal.component';
import {QueueModalComponent} from '../modals/queue-modal/queue-modal.component';
import {ProtocolFooterComponent} from '../components/protocol-footer/protocol-footer.component';
import {ToolLoaderComponent} from '../components/tool-loader/tool-loader.component';
import {AlertService} from '../shared/alert.service';
import {UploadOperation} from '../obj/operations/upload-operation';
import * as X2JS from 'x2js';
import {StatisticsModalComponent} from '../modals/statistics-modal/statistics-modal.component';
import {SettingsService} from '../shared/settings.service';
import {AppSettings} from '../shared/app.settings';
import {OHLanguageObject} from '../obj/oh-config';
import {OHModalService} from '../shared/ohmodal.service';
import {EmuOperation} from '../obj/operations/emu-operation';
import {DirectoryInfo, FileInfo, hasProperty} from '@octra/utilities';

@Component({
  selector: 'tportal-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css'],
  providers: [],
  animations: [ANIMATIONS]
})
export class MainComponent implements OnDestroy {
  public sidebarstate = 'hidden';
  public toolURL?: SafeResourceUrl;
  isCollapsed = false;
  public test = 'inactive';
  public sidebarExpand = 'opened';
  public dragborder = 'inactive';
  public newProceedingsWidth = 30;
  public newToolWidth = 70;
  @ViewChild('fileinput') fileinput?: ElementRef;
  @ViewChild('folderinput') folderinput?: ElementRef;
  @ViewChild('proceedings') proceedings?: ProceedingsComponent;
  @ViewChild('splitModal', {static: true}) splitModal?: SplitModalComponent;
  @ViewChild('firstModal', {static: true}) firstModal?: FirstModalComponent;
  @ViewChild('feedbackModal', {static: true}) feedbackModal?: FeedbackModalComponent;
  @ViewChild('queueModal') queueModal?: QueueModalComponent;
  @ViewChild('protocolFooter') protocolFooter?: ProtocolFooterComponent;
  @ViewChild('toolLoader', {static: true}) toolLoader?: ToolLoaderComponent;
  @ViewChild('statisticsModal', {static: true}) statisticsModal?: StatisticsModalComponent;
  public settingsCollapsed = true;
  private firstModalShown = false;
  private blockLeaving = true;
  private subscrmanager = new SubscriptionManager();

  public shortcutsEnabled = true;
  public accessCodeInputFieldType: 'password' | 'text' = 'password';

  constructor(public taskService: TaskService, private sanitizer: DomSanitizer,
              private httpclient: HttpClient, public notification: NotificationService,
              private storage: StorageService,
              public bugService: BugReportService,
              private alertService: AlertService,
              public settingsService: SettingsService,
              private cd: ChangeDetectorRef,
              public modalService: OHModalService
  ) {
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
        this.protocolFooter?.blop();
      }
    ));

    new Promise<void>((resolve, reject) => {
      if (this.settingsService.allLoaded) {
        resolve();
      } else {
        this.subscrmanager.add(this.settingsService.settingsload.subscribe(
          () => {
            resolve();
          }
        ));
      }
    }).then(() => {
      // configuration loaded
      this.cd.markForCheck();
      this.cd.detectChanges();
      this.taskService.selectedlanguage = AppSettings.configuration.api.languages[0];

      new Promise<any>((resolve, reject) => {
        if (!this.storage.ready) {
          this.subscrmanager.add(this.storage.allloaded.subscribe((results) => {
            resolve(results);
          }));
        } else {
          resolve([null]);
        }
      }).then((results) => {
        // idb loaded
        this.taskService.init();
        this.taskService.importDBData(results);
        this.cd.markForCheck();
        this.cd.detectChanges();

        this.storage.getIntern('firstModalShown').then(
          (result) => {
            if (!(result === null || result === undefined)) {
              this.firstModalShown = result.value;
            }
            this.loadFirstModal();
          }
        ).catch((err) => {
          console.error(err);
          this.loadFirstModal();
        });

        if (!(results[1] === null || results[1] === undefined)) {
          // read userSettings
          for (const userSetting of results[1]) {
            switch (userSetting.name) {
              case ('sidebarWidth'):
                this.newProceedingsWidth = userSetting.value;
                break;
              case ('accessCode'):
                this.taskService.accessCode = userSetting.value;
                break;
            }
          }
        }
      });
    });

    window.onunload = () => {
      return false;
    };

    this.taskService.openSplitModal = this.openSplitModal;
  }

  private _showtool = false;

  get showtool(): boolean {
    return this._showtool;
  }

  set showtool(value: boolean) {
    this.sidebarExpand = (value) ? 'closed' : 'opened';
    this._showtool = value;
  }

  public get isdevelopment(): boolean {
    return environment.development;
  }

  public get toolSelectedOperation(): Operation | undefined {
    return this.proceedings ? this.proceedings.toolSelectedOperation : undefined;
  }

  public set toolSelectedOperation(value: Operation | undefined) {
    if (this.proceedings) {
      this.proceedings.toolSelectedOperation = value;
    }
  }

  public get animationObject(): any {
    const width = 100 - this.newProceedingsWidth;
    return {value: this.sidebarExpand, params: {toolWidth: width, procWidth: this.newProceedingsWidth}};
  }

  public get animationObject2(): any {
    const width = this.newProceedingsWidth;
    return {value: this.sidebarExpand, params: {width}};
  }

  public get AppInfo() {
    return AppInfo;
  }

  public allTasks(): Task[] {
    if (!(this.taskService.taskList === null || this.taskService.taskList === undefined)) {
      return this.taskService.taskList.getAllTasks();
    }

    return [];
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  onAfterDrop(entries: (FileInfo | DirectoryInfo)[]) {
    this.readNewFiles(entries);
  }

  onVerifyButtonClick() {
    // TODO any change needed?
    const tasks = this.taskService?.taskList?.getAllTasks().filter((a) => {
      return a.state === TaskState.QUEUED;
    });

    if (tasks && tasks.length > 0) {
      this.queueModal?.open(() => {
        return true;
      });
    }
  }

  onMissedDrop(event: DragEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  onFilesAddButtonClicked() {
    this.fileinput?.nativeElement.click();
  }

  onFoldersAddButtonClicked() {
    this.folderinput?.nativeElement.click();
  }

  onFileChange($event: Event) {
    const files: FileList | null = ($event.target as HTMLInputElement).files;
    const fileInfos: FileInfo[] = [];

    if (files) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < files.length; i++) {
        const file: File = files[i];
        fileInfos.push(new FileInfo(file.name, file.type, file.size, file));
      }

      this.readNewFiles(fileInfos);
    }
  }

  onOperationClick(operation: Operation) {
    if (operation && operation instanceof ToolOperation && operation.state !== TaskState.PENDING) {
      const tool = operation as ToolOperation;
      const task = tool.task!;
      const uploadOperation = task.operations[0];
      const previousOperation = tool.previousOperation;

      if (tool.task && (uploadOperation.results.length > 0 && !uploadOperation.lastResult?.available)
        || (!(previousOperation === null || previousOperation === undefined) &&
          previousOperation.results.length > 0 && !previousOperation.lastResult?.available)) {
        if (!uploadOperation.results[0].available) {
          if ((tool.task?.files[0].file === null || tool.task?.files[0].file === undefined)) {
            this.alertService.showAlert('warning',
              `Please add the audio file "${tool.task?.files[0].attributes.originalFileName}" and run "${tool.title}" again.`, 10);
            tool.task?.operations[0].changeState(TaskState.PENDING);
            tool.task?.changeState(TaskState.PENDING);
          } else {
            // start upload process
            this.alertService.showAlert('info', `Please wait until file ${tool.task.files[0].fullname}` +
              ` being uploaded and do '${tool.title}' again.`);
            uploadOperation.statechange.subscribe(
              (state) => {
                if (state.newState === 'FINISHED') {
                  this.alertService.showAlert('success', `file ${tool.task?.files[0].fullname}` +
                    +` successfully uploaded. You can do '${tool.title}' for this file.`);
                  if (tool.task) {
                    this.storage.saveTask(tool.task);
                  }
                }
              },
              (error) => {
                console.error(error);
              }
            );
            this.taskService.start();
          }
        } else if (uploadOperation?.lastResult?.available && !previousOperation?.lastResult?.available) {
          this.alertService.showAlert('info',
            `Please run ${previousOperation?.name} for this task again.`, 12);
        }
      } else {
        let file: FileInfo;
        if (tool.results.length > 0 && !tool.lastResult?.online && tool.lastResult?.available) {
          // reupload result from tool operation
          file = tool.lastResult;
        } else if (previousOperation && previousOperation.lastResult
          && !previousOperation.lastResult.online && previousOperation.lastResult.available) {
          // reupload result from previous operation
          // local available, reupload
          file = previousOperation.lastResult;
        }

        new Promise<void>((resolve, reject) => {
          if (file && tool) {
            console.log(`reupload...`);
            this.upload(tool as Operation, file).then((url: string) => {
              console.log(`uploaded: ${url}`);
              if (tool.results.length > 0 && !tool.lastResult?.online && tool.lastResult?.available) {
                // reupload result from tool operation
                tool.lastResult.url = url;
                tool.lastResult.online = true;
              } else if (!(previousOperation?.lastResult === null || previousOperation?.lastResult === undefined)
                && !previousOperation.lastResult.online && previousOperation.lastResult.available) {
                previousOperation.lastResult.url = url;
                previousOperation.lastResult.online = true;
              }
              if (tool.task) {
                this.storage.saveTask(tool.task);
              }
              resolve();
            }).catch((e) => {
              reject(e);
            });
          } else {
            resolve();
          }
        }).then(() => {
          // continue after upload
          if (tool.task) {
            const index = tool.task.operations.findIndex((op) => {
              return op.id === tool.id;
            });

            if (index < tool.task.operations.length) {
              // start processing
              tool.changeState(TaskState.PROCESSING);
            }
          }

          this.toolURL = tool.getToolURL();

          if (this.toolURL !== '') {
            if (this.proceedings && this.toolLoader) {
              this.proceedings.cd.markForCheck();
              this.proceedings.cd.detectChanges();
              this.toolLoader.url = tool.getToolURL();
              this.toolLoader.name = tool.name;

              if (!(this.toolSelectedOperation === null || this.toolSelectedOperation === undefined)
                && operation.id !== this.toolSelectedOperation.id) {
                // some operation already initialized
                this.leaveToolOption();
              }

              this.toolSelectedOperation = operation;

              setTimeout(() => {
                this.sidebarstate = 'opened';
              }, 400);

              this.showtool = true;
              if (operation instanceof OCTRAOperation) {
                operation.time.start = Date.now();
              } else if (operation instanceof EmuOperation) {
                operation.time.start = Date.now();
              }
              this.proceedings.togglePopover(false);
              this.cd.markForCheck();
              this.cd.detectChanges();
              this.proceedings.cd.markForCheck();
              this.proceedings.cd.detectChanges();
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

  onASRLangChanged(lang: OHLanguageObject) {
    if (lang.code !== this.taskService.selectedlanguage?.code || lang.asr !== this.taskService.selectedlanguage.asr) {
      this.taskService.selectedlanguage = lang;
      this.changeLanguageforAllQueuedTasks();
      this.storage.saveUserSettings('defaultTaskOptions', {
        language: lang.code,
        asr: lang.asr
      });
    }
  }

  changeLanguageforAllQueuedTasks() {
    if (this.taskService.taskList && this.taskService.selectedlanguage) {
      const tasks = this.taskService.taskList.getAllTasks();

      for (const task of tasks) {
        if (task.state === TaskState.QUEUED) {
          task.language = this.taskService.selectedlanguage.code;
          task.asr = this.taskService.selectedlanguage.asr;
          this.storage.saveTask(task);
        }
      }
    } else {
      throw new Error('taskList is undefined');
    }
  }

  getShortCode(code: string) {
    return code.substring(code.length - 2);
  }

  onToolDataReceived(data: any) {
    const $event = data.event;

    if ($event.data.data !== undefined && hasProperty($event.data, 'data')) {
      const promise = new Promise<FileInfo>((resolve, reject) => {
        if (data.name === 'OCTRA') {
          if (hasProperty($event.data.data, 'transcript_url')) {
            const result: string = $event.data.data.transcript_url;
            const file = FileInfo.fromURL(result, 'text/plain');
            file.updateContentFromURL(this.httpclient).then(() => {
              const inputs = this.toolSelectedOperation?.task?.files;
              if (!inputs) {
                resolve(file);
                return;
              }

              const name = (inputs[0].attributes?.originalFileName ?? inputs[0].fullname).replace(/\.[^.]+$/g, '');

              file.attributes = {
                originalFileName: `${name}${file.extension}`
              };

              resolve(file);
            }).catch((e) => {
              reject(e);
            });
          } else {
            reject(`missing transcript url`);
          }
        } else if (data.name === 'Emu WebApp') {
          if (this.toolSelectedOperation && this.toolSelectedOperation.task) {
            const inputs = this.toolSelectedOperation?.task?.files;
            if (!inputs) {
              reject(`Can't find any inputs for this task.`);
              return;
            }

            const fileName = (inputs[0].attributes?.originalFileName ?? inputs[0].fullname).replace(/\.[^.]+$/g, '');

            this.toolSelectedOperation.changeState(TaskState.FINISHED);
            this._showtool = false;
            let jsonText = '';
            if (hasProperty($event.data.data, 'annotation')) {
              const json = $event.data.data.annotation;
              json.name = fileName;
              json.annotates = `${fileName}_annot.json`;
              jsonText = JSON.stringify(json, null, 2);
            }

            const file: File = FileInfo.getFileFromContent(jsonText, `${fileName}_annot.json`, 'text/plain');
            const fileInfo = new FileInfo(`${fileName}_annot.json`, 'text/plain', file.size, file, Date.now());

            fileInfo.attributes = {
              originalFileName: `${fileName}_annot.json`
            };

            fileInfo.online = false;
            resolve(fileInfo);
          }
        } else {
          reject('unknown tool!');
        }
      }).then((file: FileInfo) => {
        if (this.toolSelectedOperation && this.toolSelectedOperation.task) {
          this.toolSelectedOperation.results.push(file);

          const index = this.toolSelectedOperation.task.operations.findIndex((op) => {
            return this.toolSelectedOperation && op.id === this.toolSelectedOperation.id;
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
          } else if (this.toolSelectedOperation instanceof EmuOperation) {
            this.toolSelectedOperation.time.duration += Date.now() - this.toolSelectedOperation.time.start;
          }

          this.toolSelectedOperation.changeState(TaskState.FINISHED);
          this.storage.saveTask(this.toolSelectedOperation.task);

          setTimeout(() => {
            if (this.toolSelectedOperation && this.toolSelectedOperation.task && this.toolSelectedOperation.task.state === 'FINISHED'
              && this.toolSelectedOperation.task.operations[1] && this.toolSelectedOperation.task.operations[1].providerInformation) {
              const langObj = AppSettings.getLanguageByCode(this.toolSelectedOperation.task.language,
                this.toolSelectedOperation.task.operations[1].providerInformation.provider);
              if (langObj) {
                this.toolSelectedOperation.task.restart(langObj, this.httpclient, [{
                  name: 'GoogleASR',
                  value: this.taskService.accessCode
                }]);
              } else {
                throw new Error('langObj is undefined');
              }
            }
            this.onBackButtonClicked();
          }, 1000);
        }
      }).catch((error) => {
        console.error(error);
      });
    }
  }

  onBackButtonClicked() {
    this.showtool = false;
    setTimeout(() => {
      this.sidebarstate = 'hidden';
      setTimeout(() => {
        if (this.toolLoader) {
          this.toolLoader.url = undefined;
        }
      }, 1000);
    }, 200);
    this.leaveToolOption();
  }

  leaveToolOption() {
    if (this.toolSelectedOperation) {
      if (this.toolSelectedOperation.nextOperation && this.toolSelectedOperation.nextOperation.state === TaskState.FINISHED) {
        this.toolSelectedOperation.changeState(TaskState.FINISHED);
      } else if (this.toolSelectedOperation.state !== TaskState.FINISHED) {
        if (this.toolSelectedOperation.results.length > 0) {
          this.toolSelectedOperation.changeState(TaskState.FINISHED);
        } else {
          this.toolSelectedOperation.changeState(TaskState.READY);
        }
      }
    }

    this.toolSelectedOperation = undefined;
  }

  @HostListener('window:beforeunload', ['$event'])
  doSomething($event: Event) {
    if (!AppInfo.debugging) {
      $event.returnValue = this.blockLeaving;
    }
  }

  public getTime(): number {
    if (this.toolSelectedOperation?.task) {
      const elem: AudioInfo = this.toolSelectedOperation.task.files[0] as AudioInfo;

      if (!(elem.duration === null || elem.duration === undefined)) {
        return elem.duration.unix;
      }
    }

    return 0;
  }

  public openSplitModal = () => {
    this.splitModal?.open((reason) => {
      this.taskService.splitPrompt = reason;
      this.taskService.checkFiles();
    });
  }

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

  public onBlur($event: Event) {
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

  onStartClick() {
    this.taskService.toggleProcessing();
  }

  onFeedbackRequest(operation: Operation) {
    this.bugService.addEntry(ConsoleType.INFO, `user clicked on report issue:\n`
      + `operation: ${operation.name}, ${operation.state}\n`
      + `protocol: ${operation.protocol}\n`);
    this.modalService.openFeedbackModal();
  }

  private loadFirstModal() {
    if (!this.firstModalShown && this.firstModal) {

      this.subscrmanager.add(this.firstModal.understandClick.subscribe(
        () => {
          this.firstModalShown = true;
        }
      ));
      setTimeout(() => {
        this.firstModal?.open(() => {
          return this.firstModalShown;
        }, () => {
          this.storage.saveIntern('firstModalShown', true);
        });
      }, 1000);
    }
  }

  private readNewFiles(entries: (FileInfo | DirectoryInfo)[]) {
    if (!(entries === null || entries === undefined) &&
      !(this.taskService.operations === null || this.taskService.operations === undefined)) {
      // filter and re-structure entries array to supported files and directories
      const filteredEntries = this.taskService.cleanUpInputArray(entries);

      for (const entry of filteredEntries) {
        this.taskService.preprocessor.addToQueue(entry);
      }
    }
  }

  public openFeedbackModal() {
    this.modalService.openFeedbackModal();
  }

  private upload(operation: Operation, file: FileInfo): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      if (operation && operation.task && operation.task.operations[1].providerInformation) {
        const langObj = AppSettings.getLanguageByCode(operation.task.language, operation.task.operations[1].providerInformation.provider);
        const url = `${langObj?.host}uploadFileMulti`;

        const subj = UploadOperation.upload([file], url, this.httpclient);
        subj.subscribe((obj) => {
          if (obj.type === 'loadend') {
            const result = obj.result as string;
            const x2js = new X2JS();
            let json: any = x2js.xml2js(result);
            json = json.UploadFileMultiResponse;


            // add messages to protocol
            if (json.warnings !== '') {
              console.warn(json.warnings);
            }

            if (json.success === 'true') {
              if (Array.isArray(json.fileList.entry)) {
                resolve(json.fileList.entry[0].value);
              } else {
                // json attribute entry is an object
                resolve(json.fileList.entry.value);
              }
            } else {
              reject(json.message);
            }
          }
        }, (err) => {
          reject(err);
        });
      }
    });
  }

  toggleAccessCodeInputType() {
    if (this.accessCodeInputFieldType === 'password') {
      this.accessCodeInputFieldType = 'text';
    } else {
      this.accessCodeInputFieldType = 'password';
    }
  }
}
