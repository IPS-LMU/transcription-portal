import { DatePipe, NgClass, NgStyle } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, HostListener, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  NgbCollapse,
  NgbDropdown,
  NgbDropdownMenu,
  NgbDropdownToggle,
  NgbModal,
  NgbNavModule,
  NgbPopover,
  NgbTooltip,
} from '@ng-bootstrap/ng-bootstrap';
import { AnnotJSONConverter, IFile, OAnnotJSON, PartiturConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { hasProperty } from '@octra/utilities';
import { AudioInfo, DirectoryInfo, FileInfo } from '@octra/web-media';
import { DateTime } from 'luxon';
import { forkJoin, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppInfo } from '../../app.info';
import { AlertComponent } from '../../components/alert/alert.component';
import { ProceedingsComponent } from '../../components/proceedings/proceedings.component';
import { ToolLoaderComponent } from '../../components/tool-loader/tool-loader.component';
import { AboutModalComponent } from '../../modals/about-modal/about-modal.component';
import { FirstModalComponent } from '../../modals/first-modal/first-modal.component';
import { QueueModalComponent } from '../../modals/queue-modal/queue-modal.component';
import { SplitModalComponent } from '../../modals/split-modal/split-modal.component';
import { StatisticsModalComponent } from '../../modals/statistics-modal/statistics-modal.component';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { openModal } from '../../obj/functions';
import { EmuOperation } from '../../obj/operations/emu-operation';
import { OCTRAOperation } from '../../obj/operations/octra-operation';
import { Operation } from '../../obj/operations/operation';
import { ToolOperation } from '../../obj/operations/tool-operation';
import { UploadOperation } from '../../obj/operations/upload-operation';
import { TaskStatus } from '../../obj/tasks';
import { TaskService } from '../../obj/tasks/task.service';
import { AlertService } from '../../shared/alert.service';
import { ANIMATIONS } from '../../shared/Animations';
import { AppSettings } from '../../shared/app.settings';
import { BugReportService, ConsoleType } from '../../shared/bug-report.service';
import { NotificationService } from '../../shared/notification.service';
import { OHModalService } from '../../shared/ohmodal.service';
import { SettingsService } from '../../shared/settings.service';
import { TimePipe } from '../../shared/time.pipe';
import { StorageService } from '../../storage.service';

@Component({
  selector: 'tportal-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
  providers: [],
  animations: [ANIMATIONS],
  imports: [
    AlertComponent,
    NgClass,
    FormsModule,
    NgStyle,
    ProceedingsComponent,
    ToolLoaderComponent,
    DatePipe,
    TimePipe,
    NgbCollapse,
    NgbTooltip,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    NgbNavModule,
    NgbPopover,
  ],
})
export class MainComponent extends SubscriberComponent implements OnDestroy {
  taskService = inject(TaskService);
  private ngbModalService = inject(NgbModal);
  private httpClient = inject(HttpClient);
  notification = inject(NotificationService);
  private storage = inject(StorageService);
  bugService = inject(BugReportService);
  private alertService = inject(AlertService);
  settingsService = inject(SettingsService);
  private cd = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);
  modalService = inject(OHModalService);

  public sidebarstate = 'hidden';
  private toolURL?: string;
  isCollapsed = false;
  public test = 'inactive';
  public sidebarExpand = 'opened';
  public dragborder = 'inactive';
  public newProceedingsWidth = 30;
  public newToolWidth = 70;
  public settingsCollapsed = true;
  private firstModalShown = false;
  private blockLeaving = true;
  public accessCodeInputFieldType: 'password' | 'text' = 'password';

  protected dbBackup: {
    url?: string;
    safeURL?: SafeUrl;
    filename?: string;
  } = {};

  private tabOrder = {
    annotation: 1,
    summarization: 2,
  };

  activeMode = 1;

  sumProjectName = '';

  @ViewChild('fileinput') fileinput?: ElementRef;
  @ViewChild('proceedings') proceedings?: ProceedingsComponent;
  @ViewChild('toolLoader', { static: true }) toolLoader?: ToolLoaderComponent;

  constructor() {
    super();
    this.subscribe(this.notification.onPermissionChange, {
      next: (result) => {
        if (this.storage.ready) {
          this.storage.saveUserSettings('notification', {
            enabled: result,
          });
        }
      },
    });

    this.subscribe(
      forkJoin<{
        settings: Observable<boolean>;
        idb: Observable<any>;
      }>({
        settings: this.settingsService.settingsload,
        idb: this.storage.allloaded,
      }),
      {
        complete: () => {
          // configuration loaded
          const { annotationTasks, summarizationTasks, userSettings } = this.storage.allloaded.value;
          this.cd.markForCheck();

          // idb loaded
          this.taskService.init();
          this.taskService
            .importDBData({
              annotationTasks,
              summarizationTasks,
              userSettings,
            })
            .catch((error) => {
              console.error(error);
            });
          this.cd.markForCheck();

          this.storage.idbm.intern
            .get('firstModalShown')
            .then((result) => {
              if (!(result === null || result === undefined)) {
                this.firstModalShown = result.value;
              }
              this.loadFirstModal();
            })
            .catch((err) => {
              console.error(err);
              this.loadFirstModal();
            });

          if (userSettings) {
            // read userSettings
            for (const userSetting of userSettings) {
              switch (userSetting.name) {
                case 'sidebarWidth':
                  this.newProceedingsWidth = userSetting.value;
                  break;
                case 'accessCode':
                  this.taskService.accessCode = userSetting.value;
                  break;
              }
            }
          }
        },
      },
    );

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
    this.sidebarExpand = value ? 'closed' : 'opened';
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
    return {
      value: this.sidebarExpand,
      params: { toolWidth: width, procWidth: this.newProceedingsWidth },
    };
  }

  public get animationObject2(): any {
    const width = this.newProceedingsWidth;
    return { value: this.sidebarExpand, params: { width } };
  }

  public get AppInfo() {
    return AppInfo;
  }

  onAfterDrop(entries: (FileInfo | DirectoryInfo)[]) {
    this.readNewFiles(entries);
  }

  onVerifyButtonClick() {
    const taskList = this.taskService.state.currentModeState.taskList;
    const tasks = taskList?.getAllTasks().filter((a) => {
      return a.status === TaskStatus.QUEUED;
    });

    if (tasks && tasks.length > 0) {
      this.openQueueModal();
    }
  }

  async openQueueModal() {
    this.settingsService.shortCutsEnabled = false;
    const ref = openModal<QueueModalComponent>(this.ngbModalService, QueueModalComponent, QueueModalComponent.options);
    const taskList = this.taskService.state.currentModeState.taskList;
    ref.componentInstance.queue = this.taskService.state.currentModeState.preprocessor.queue;
    ref.componentInstance.tasks = taskList?.getAllTasks() ?? [];
    ref.componentInstance.operations = this.taskService.state.currentModeState.operations;
    await ref.result;
    this.settingsService.shortCutsEnabled = true;
  }

  onMissedDrop(event: DragEvent) {
    event.stopPropagation();
    event.preventDefault();
  }

  onFilesAddButtonClicked() {
    this.fileinput?.nativeElement.click();
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

  async onOperationClick(operation: Operation) {
    if (operation && operation instanceof ToolOperation && operation.state !== TaskStatus.PENDING && operation.task) {
      // operation is of type tool and ready
      const tool = operation as ToolOperation;
      const task = operation.task;
      const uploadOperation = task.operations[0];
      const previousOperation = tool.previousOperation;
      const isUploadOperationAudioFileNotAvailable = uploadOperation.results.length > 0 && !uploadOperation.results[0].available;
      const isPreviousTaskDefinedAndLastResultNotAvailable =
        previousOperation && previousOperation.results.length > 0 && !previousOperation.lastResult?.available;

      if (isUploadOperationAudioFileNotAvailable || isPreviousTaskDefinedAndLastResultNotAvailable) {
        if (isUploadOperationAudioFileNotAvailable) {
          // audio file is not available
          if (task && !task?.files[0].file) {
            this.alertService.showAlert(
              'warning',
              `Please add the audio file "${task.files[0].attributes.originalFileName}" and run "${tool.title}" again.`,
              10,
            );
            task.operations[0].changeState(TaskStatus.PENDING);
            task.changeState(TaskStatus.PENDING);
          } else {
            // start upload process
            this.alertService.showAlert('info', `Please wait until file ${task.files[0].fullname}` + ` being uploaded and do '${tool.title}' again.`);
            this.subscribe(uploadOperation.statechange, {
              next: (state) => {
                if (state.newState === 'FINISHED') {
                  this.alertService.showAlert(
                    'success',
                    `file ${task?.files[0].fullname}` + +` successfully uploaded. You can do '${tool.title}' for this file.`,
                  );
                  if (task) {
                    this.storage.saveTask(task, this.taskService.state.currentMode);
                  }
                }
              },
              error: (error) => {
                console.error(error);
              },
            });
            this.taskService.start(this.taskService.state.currentMode);
          }
        } else if (!previousOperation?.lastResult?.available) {
          // audio file available but no result of previous operation
          this.alertService.showAlert('info', `Please run ${previousOperation?.name} for this task again.`, 12);
        }
      } else {
        // audio file exists and last result of previous operation exists

        let file: FileInfo | undefined = undefined;
        if (tool.results.length > 0) {
          if (!tool.lastResult?.online && tool.lastResult?.available) {
            // file for last result of current tool exists, but isn't available via URL
            // reupload result from tool operation
            file = tool.lastResult;
          }
        } else if (
          previousOperation &&
          previousOperation.lastResult &&
          !previousOperation.lastResult.online &&
          previousOperation.lastResult.available
        ) {
          // reupload result from previous operation
          // local available, reupload
          file = previousOperation.lastResult;
        }

        if (file && tool) {
          console.log(`reupload...`);
          console.log(file);
          const url = await this.upload(tool as Operation, file);
          console.log(`uploaded: ${url}`);
          if (tool.results.length > 0 && !tool.lastResult?.online && tool.lastResult?.available) {
            // reupload result from tool operation
            tool.lastResult.url = url;
            tool.lastResult.online = true;
          } else if (
            !(previousOperation?.lastResult === null || previousOperation?.lastResult === undefined) &&
            !previousOperation.lastResult.online &&
            previousOperation.lastResult.available
          ) {
            previousOperation.lastResult.url = url;
            previousOperation.lastResult.online = true;
          }

          if (task) {
            this.storage.saveTask(task, this.taskService.state.currentMode);
          }
        }

        // continue after upload
        if (task) {
          const index = task.operations.findIndex((op) => {
            return op.id === tool.id;
          });

          if (index < task.operations.length) {
            // start processing
            tool.changeState(TaskStatus.PROCESSING);
          }
        }

        this.toolURL = await tool.getToolURL(this.httpClient);

        if (this.toolURL !== '') {
          if (this.proceedings && this.toolLoader) {
            this.proceedings.cd.markForCheck();
            this.proceedings.cd.detectChanges();
            this.toolLoader.url = this.toolURL;
            this.toolLoader.name = tool.name;

            if (
              !(this.toolSelectedOperation === null || this.toolSelectedOperation === undefined) &&
              operation.id !== this.toolSelectedOperation.id
            ) {
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
      }
    }
  }

  onOperationHover(operation: Operation) {}

  getShortCode(code: string) {
    return code.substring(code.length - 2);
  }

  onToolDataReceived(data: any, toolLoader: ToolLoaderComponent) {
    const $event = data.event;

    if ($event.data.data !== undefined && hasProperty($event.data, 'data')) {
      (async () => {
        if (data.name === 'OCTRA') {
          if (hasProperty($event.data, 'status') && $event.data.status === 'success' && hasProperty($event.data.data, 'annotation')) {
            const result: any = $event.data.data.annotation;
            let annotation: IFile | undefined;

            try {
              const converter = new AnnotJSONConverter();
              const audio = this.toolSelectedOperation?.task!.files.find((a) => a.type.includes('audio')) as AudioInfo;
              const audiofile = new OAudiofile();
              audiofile.url = audio.url;
              audiofile.name = audio.fullname;
              audiofile.type = audio.type;
              audiofile.size = audio.size;
              audiofile.duration = audio.duration.samples;
              audiofile.sampleRate = (audio as AudioInfo).sampleRate;
              const importResult = converter.import(result, audiofile);

              if (importResult.annotjson && !importResult.error) {
                const exportConverter = new PartiturConverter();
                const oAnnotJSON = OAnnotJSON.deserialize(importResult.annotjson);
                const exportResult = exportConverter.export(oAnnotJSON!, audiofile, 0);

                if (exportResult.file && !exportResult.error) {
                  annotation = exportResult.file;
                } else {
                  throw new Error(`Export: ${exportResult.error}`);
                }
              } else {
                throw new Error(`Import: ${importResult.error}`);
              }
            } catch (e) {
              console.error(e);
              throw new Error('Converting to TextGrid failed!');
            }

            if (!annotation) {
              throw new Error('Annotation is undefined.');
            }

            const blob = new File([annotation.content], annotation.name, {
              type: annotation?.type,
            });
            const file = new FileInfo(annotation.name, annotation.type, blob.size, blob);
            const inputs = this.toolSelectedOperation?.task?.files;

            const url = await this.upload(toolLoader.operation as ToolOperation, file);
            file.url = url;

            if (!inputs) {
              return file;
            }

            const name = (inputs[0].attributes?.originalFileName ?? inputs[0].fullname).replace(/\.[^.]+$/g, '');

            file.attributes = {
              originalFileName: `${name}${file.extension}`,
            };

            return file;
          }
          throw new Error(`missing transcript url`);
        } else if (data.name === 'Emu WebApp') {
          if (this.toolSelectedOperation && this.toolSelectedOperation.task) {
            const inputs = this.toolSelectedOperation?.task?.files;
            if (!inputs) {
              throw new Error(`Can't find any inputs for this task.`);
            }

            const fileName = (inputs[0].attributes?.originalFileName ?? inputs[0].fullname).replace(/\.[^.]+$/g, '');

            this.toolSelectedOperation.changeState(TaskStatus.FINISHED);
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
              originalFileName: `${fileName}_annot.json`,
            };

            fileInfo.online = false;
            return fileInfo;
          }
        }
        throw new Error('unknown tool!');
      })()
        .then((file: FileInfo) => {
          if (this.toolSelectedOperation && this.toolSelectedOperation.task) {
            this.toolSelectedOperation.results.push(file);

            const index = this.toolSelectedOperation.task.operations.findIndex((op) => {
              return this.toolSelectedOperation && op.id === this.toolSelectedOperation.id;
            });

            // reset next operations
            if (index > -1) {
              for (let i = index + 1; i < this.toolSelectedOperation.task.operations.length; i++) {
                const operation = this.toolSelectedOperation.task.operations[i];
                operation.changeState(TaskStatus.PENDING);
              }
            }

            if (this.toolSelectedOperation instanceof OCTRAOperation) {
              this.toolSelectedOperation.time.duration += Date.now() - this.toolSelectedOperation.time.start;
            } else if (this.toolSelectedOperation instanceof EmuOperation) {
              this.toolSelectedOperation.time.duration += Date.now() - this.toolSelectedOperation.time.start;
            }

            this.toolSelectedOperation.changeState(TaskStatus.FINISHED);
            this.storage.saveTask(this.toolSelectedOperation.task, this.taskService.state.currentMode);

            setTimeout(() => {
              if (
                this.toolSelectedOperation &&
                this.toolSelectedOperation.task &&
                this.toolSelectedOperation.task.status === 'FINISHED' &&
                this.toolSelectedOperation.task.asrOperation &&
                this.toolSelectedOperation.task.asrOperation.serviceProvider &&
                this.toolSelectedOperation.task.asrOperation.language
              ) {
                this.toolSelectedOperation.task.restart(this.httpClient, [
                  {
                    name: 'GoogleASR',
                    value: this.taskService.accessCode,
                  },
                ]);
              }
              this.onBackButtonClicked();
            }, 1000);
          }
        })
        .catch((error) => {
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
      if (this.toolSelectedOperation.nextOperation && this.toolSelectedOperation.nextOperation.state === TaskStatus.FINISHED) {
        this.toolSelectedOperation.changeState(TaskStatus.FINISHED);
      } else if (this.toolSelectedOperation.state !== TaskStatus.FINISHED) {
        if (this.toolSelectedOperation.results.length > 0) {
          this.toolSelectedOperation.changeState(TaskStatus.FINISHED);
        } else {
          this.toolSelectedOperation.changeState(TaskStatus.READY);
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
    const ref = this.ngbModalService.open(SplitModalComponent, SplitModalComponent.options);
    ref.result.then((reason) => {
      this.taskService.splitPrompt = reason;
      this.taskService.checkFiles(this.taskService.state.currentMode);
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
        const procWidth = Math.floor((($event.pageX + 10) / window.innerWidth) * 100);
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
      case 'mousedown':
        if (this.dragborder === 'active') {
          this.dragborder = 'dragging';
        }
        break;
      case 'mouseup':
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

  public async onClearClick() {
    const ref = openModal<YesNoModalComponent>(this.ngbModalService, YesNoModalComponent, YesNoModalComponent.options, {
      title: "Confirmation needed",
      type: "danger",
      message:
        '<p class="text-center">Are you sure you want to clear all data? If you click on "yes" all data related to the TranscriptionPortal is permanently removed.</p>',
    });
    const result = await ref.result;

    if (result === 'yes') {
      this.storage.clearAll();
    }
  }

  onStartClick() {
    this.taskService.toggleProcessing();
  }

  onFeedbackRequest(operation: Operation) {
    this.bugService.addEntry(
      ConsoleType.INFO,
      `user clicked on report issue:\n` + `operation: ${operation.name}, ${operation.state}\n` + `protocol: ${operation.protocol}\n`,
    );
    this.modalService.openFeedbackModal();
  }

  private loadFirstModal() {
    if (!this.firstModalShown) {
      setTimeout(() => {
        const ref = this.ngbModalService.open(FirstModalComponent, FirstModalComponent.options);
        ref.result.then(() => {
          this.storage.saveIntern('firstModalShown', true);
        });
      }, 1000);
    }
  }

  private readNewFiles(entries: (FileInfo | DirectoryInfo)[]) {
    if (entries && this.taskService.state.currentModeState.operations) {
      // filter and re-structure entries array to supported files and directories
      const filteredEntries = this.taskService.cleanUpInputArray(entries);

      for (const entry of filteredEntries) {
        this.taskService.state.currentModeState.preprocessor.addToQueue(entry);
      }
    }
  }

  public async openFeedbackModal() {
    this.settingsService.shortCutsEnabled = false;
    await this.modalService.openFeedbackModal();
    this.settingsService.shortCutsEnabled = true;
  }

  private upload(operation: Operation, file: FileInfo): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const serviceProvider = AppSettings.getServiceInformation('BAS');
      if (operation && operation.task && serviceProvider) {
        const url = `${serviceProvider.host}uploadFileMulti`;
        const subj = UploadOperation.upload([file], url, this.httpClient);
        subj.subscribe({
          next: (obj) => {
            if (obj.type === 'loadend') {
              // add messages to protocol
              if (obj.warnings) {
                console.warn(obj.warnings);
              }
              resolve(obj.urls![0]);
            }
          },
          error: (err) => {
            reject(err);
          },
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

  async openStatisticsModal() {
    this.settingsService.shortCutsEnabled = false;
    const ref = this.ngbModalService.open(StatisticsModalComponent, StatisticsModalComponent.options);
    this.settingsService.shortCutsEnabled = false;
    ref.result
      .then(() => {
        this.settingsService.shortCutsEnabled = true;
      })
      .catch((err) => {
        this.settingsService.shortCutsEnabled = true;
      });
    await ref.result;
    this.settingsService.shortCutsEnabled = true;
  }

  changeMode(mode: 'annotation' | 'summarization') {
    this.taskService.state.currentMode = mode;
  }

  openAboutModal() {
    const ref = openModal<AboutModalComponent>(this.ngbModalService, AboutModalComponent, AboutModalComponent.options);
    return ref.result;
  }

  async backupDatabase() {
    this.dbBackup.url = await this.storage.backup();
    this.dbBackup.safeURL = this.sanitizer.bypassSecurityTrustResourceUrl(this.dbBackup.url);
    this.dbBackup.filename = `tportal_backup_${DateTime.now().toISO()}.idb`;
  }

  onSettingsDropdownChange(opened: boolean) {
    if (!opened) {
      if (this.dbBackup?.url) {
        URL.revokeObjectURL(this.dbBackup.url);
        this.dbBackup = {};
      }
    }
  }

  async onRestoreFileSelected(restoreInput: HTMLInputElement) {
    if (restoreInput.files && restoreInput.files.length === 1) {
      const blob = restoreInput.files.item(0);
      if (blob) {
        await this.storage.importBackup(blob);
      }
    }

    restoreInput.files = null;
    restoreInput.value = '';
  }
}
