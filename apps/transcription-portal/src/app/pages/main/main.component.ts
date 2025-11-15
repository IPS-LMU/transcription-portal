import { AsyncPipe, DatePipe, JsonPipe, NgClass, NgStyle } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, inject, OnDestroy, ViewChild } from '@angular/core';
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
import { SubscriberComponent } from '@octra/ngx-utilities';
import { environment } from '../../../environments/environment';
import { AppInfo } from '../../app.info';
import { AlertComponent } from '../../components/alert/alert.component';
import ProceedingsTableComponent from '../../components/proceedings-table/proceedings-table.component';
import { ToolLoaderComponent } from '../../components/tool-loader/tool-loader.component';
import { AboutModalComponent } from '../../modals/about-modal/about-modal.component';
import { QueueModalComponent } from '../../modals/queue-modal/queue-modal.component';
import { StatisticsModalComponent } from '../../modals/statistics-modal/statistics-modal.component';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { openModal } from '../../obj/functions';
import { TPortalDirectoryInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { AlertService } from '../../shared/alert.service';
import { ANIMATIONS } from '../../shared/Animations';
import { BugReportService } from '../../shared/bug-report.service';
import { NotificationService } from '../../shared/notification.service';
import { OHModalService } from '../../shared/ohmodal.service';
import { SettingsService } from '../../shared/settings.service';
import { TimePipe } from '../../shared/time.pipe';
import { StorageService } from '../../storage.service';
import {
  AppStoreService,
  ModeStoreService,
  OperationFactory,
  PreprocessingStoreService,
  StoreItemTask,
  StoreTaskOperation,
  TaskStatus,
} from '../../store';
import { getLastOperationRound } from '../../store/operation/operation.functions';

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
    ProceedingsTableComponent,
    ToolLoaderComponent,
    NgbCollapse,
    NgbTooltip,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    NgbNavModule,
    NgbPopover,
    DatePipe,
    AsyncPipe,
    JsonPipe,
  ],
})
export class MainComponent extends SubscriberComponent implements OnDestroy {
  protected ngbModalService = inject(NgbModal);
  protected httpClient = inject(HttpClient);
  protected notification = inject(NotificationService);
  protected storage = inject(StorageService);
  protected bugService = inject(BugReportService);
  protected alertService = inject(AlertService);
  protected settingsService = inject(SettingsService);
  protected sanitizer = inject(DomSanitizer);
  protected modalService = inject(OHModalService);
  protected appStoreService = inject(AppStoreService);
  protected modeStoreService = inject(ModeStoreService);
  protected preprocessingStoreService = inject(PreprocessingStoreService);

  public sidebarstate = 'hidden';
  private toolURL?: string;
  isCollapsed = false;
  public test = 'inactive';
  public sidebarExpand = 'opened';
  public dragborder = 'inactive';
  public newProceedingsWidth = 30;
  public newToolWidth = 70;
  public settingsCollapsed = true;
  public accessCodeInputFieldType: 'password' | 'text' = 'password';
  protected toolSelectedOperation?: StoreTaskOperation;
  protected dbBackup: {
    url?: string;
    safeURL?: SafeUrl;
    filename?: string;
  } = {};

  activeMode = 1;

  @ViewChild('fileinput') fileinput?: ElementRef;
  @ViewChild('proceedings') proceedings?: ProceedingsTableComponent;
  @ViewChild('toolLoader', { static: true }) toolLoader?: ToolLoaderComponent;

  constructor() {
    super();
    this.subscribe(this.modeStoreService.openedToolOperation$, {
      next: (toolOperation) => {
        this.toolSelectedOperation = toolOperation;
      },
    });
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

  onAfterDrop(entries: (TPortalFileInfo | TPortalDirectoryInfo)[]) {
    this.readNewFiles(entries);
  }

  onVerifyButtonClick() {
    this.openQueueModal().catch((err) => {
      console.error(err);
    });
  }

  async openQueueModal() {
    this.settingsService.shortCutsEnabled = false;
    const ref = openModal<QueueModalComponent>(this.ngbModalService, QueueModalComponent, QueueModalComponent.options);
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

  onFileChange(input: HTMLInputElement) {
    const files: FileList | null = input.files;
    const fileInfos: TPortalFileInfo[] = [];

    if (files) {
      // tslint:disable-next-line:prefer-for-of
      for (let i = 0; i < files.length; i++) {
        const file: File = files[i];
        fileInfos.push(new TPortalFileInfo(file.name, file.type, file.size, file));
      }

      this.readNewFiles(fileInfos);
    }
    input.value = '';
  }

  async onOperationClick({ operation }: { operation: StoreTaskOperation; task: StoreItemTask; opIndex: number; factory: OperationFactory }) {
    if (
      operation &&
      ['OCTRA', 'Emu WebApp'].includes(operation.name) &&
      getLastOperationRound(operation)?.status !== TaskStatus.PENDING &&
      operation.taskID
    ) {
      this.modeStoreService.openOperationWithTool(operation);
    }
  }

  onOperationHover(operation: StoreTaskOperation) {}

  getShortCode(code: string) {
    return code.substring(code.length - 2);
  }

  onToolDataReceived(data: any, toolLoader: ToolLoaderComponent) {
    /* TODO add
    const $event = data.event;

    if ($event.data.data !== undefined && hasProperty($event.data, 'data')) {
      (async () => {
        if (data.name === 'OCTRA') {
          if (hasProperty($event.data, 'status') && $event.data.status === 'success' && hasProperty($event.data.data, 'annotation')) {
            const result: any = $event.data.data.annotation;
            let annotation: IFile | undefined;

            try {
              const converter = new AnnotJSONConverter();
              const audio = this.toolSelectedOperation?.task!.files.find((a) => a.isMediaFile()) as any as TPortalAudioInfo;
              const audiofile = new OAudiofile();
              audiofile.url = audio.url;
              audiofile.name = audio.fullname;
              audiofile.type = audio.type;
              audiofile.size = audio.size;
              audiofile.duration = audio.duration.samples;
              audiofile.sampleRate = (audio as TPortalAudioInfo).sampleRate;
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
            const file = new TPortalFileInfo(annotation.name, annotation.type, blob.size, blob);
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
        } else if (data.name === 'Emu WebApp') {
          if (this.toolSelectedOperation && this.toolSelectedOperation.task) {
            const inputs = this.toolSelectedOperation?.task?.files;
            if (!inputs) {
              throw new Error(`Can't find any inputs for this task.`);
            }

            const fileName = (inputs[0].attributes?.originalFileName ?? inputs[0].fullname).replace(/\.[^.]+$/g, '');

            this._showtool = false;
            let jsonText = '';
            if (hasProperty($event.data.data, 'annotation')) {
              const json = $event.data.data.annotation;
              json.name = fileName;
              json.annotates = `${fileName}_annot.json`;
              jsonText = JSON.stringify(json, null, 2);
            }

            const file: File = TPortalFileInfo.getFileFromContent(jsonText, `${fileName}_annot.json`, 'text/plain');
            const fileInfo = new TPortalFileInfo(`${fileName}_annot.json`, 'text/plain', file.size, file, Date.now());

            fileInfo.attributes = {
              originalFileName: `${fileName}_annot.json`,
            };

            fileInfo.online = false;
            return fileInfo;
          }
        }
        return undefined;
      })()
        .then(async (file: TPortalFileInfo | undefined) => {
          if (file) {
            if (this.toolSelectedOperation?.lastRound && this.toolSelectedOperation.task) {
              this.toolSelectedOperation.lastRound.results.push(file);

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

              if (
                (this.toolSelectedOperation instanceof OCTRAOperation || this.toolSelectedOperation instanceof EmuOperation) &&
                this.toolSelectedOperation.time
              ) {
                this.toolSelectedOperation.time.duration =
                  (this.toolSelectedOperation.time.duration ?? 0) + Date.now() - this.toolSelectedOperation.time.start;
              }

              this.toolSelectedOperation.changeState(TaskStatus.FINISHED);
              this.storage.saveTask(this.toolSelectedOperation.task, this.taskService.state.currentMode);

              await wait(1);

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
            }
          }
        })
        .catch((error) => {
          console.error(error);
        });
    }

     */
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
    this.leaveToolOperation();
  }

  leaveToolOperation() {
    /* TODO ADD
    if (this.toolSelectedOperation) {
      if (this.toolSelectedOperation.lastRound && !this.toolSelectedOperation.lastRound.lastResult && this.toolSelectedOperation.rounds.length > 1) {
        // remove empty round
        this.toolSelectedOperation.removeRoundsByIndex(-1, 1);
      }
      if (this.toolSelectedOperation.nextOperation && this.toolSelectedOperation.nextOperation.state === TaskStatus.FINISHED) {
        this.toolSelectedOperation.changeState(TaskStatus.FINISHED);
      } else if (this.toolSelectedOperation.state !== TaskStatus.FINISHED) {
        if (this.toolSelectedOperation.rounds.length > 0) {
          this.toolSelectedOperation.changeState(TaskStatus.FINISHED);
        } else {
          this.toolSelectedOperation.changeState(TaskStatus.READY);
        }
      }
    }

    this.toolSelectedOperation = undefined;
    this.proceedings?.cd.markForCheck();
    this.proceedings?.cd.detectChanges();

     */
  }

  @HostListener('window:beforeunload', ['$event'])
  doSomething($event: Event) {
    if (environment.debugging.enabled) {
      return 'Are you sure you want to leave the TranscriptionPortal? Maybe running processes are going to be canceled.';
    }
    return '';
  }

  public getTime(): number {
    /* TODO ADD
    if (this.toolSelectedOperation?.task) {
      const elem: TPortalAudioInfo = this.toolSelectedOperation.task.files[0] as any as TPortalAudioInfo;

      if (!(elem.duration === null || elem.duration === undefined)) {
        return elem.duration.unix;
      }
    }

     */

    return 0;
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
        const procWidth = Math.floor((($event.pageX + 10) / window.innerWidth) * 100);
        const toolWidth = 100 - procWidth;

        this.newToolWidth = toolWidth;
        this.newProceedingsWidth = procWidth;
        this.appStoreService.changeSidebarWidth(this.newProceedingsWidth);
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
    this.appStoreService.changeSidebarWidth(this.newProceedingsWidth);
  }

  public async onClearClick() {
    const ref = openModal<YesNoModalComponent>(this.ngbModalService, YesNoModalComponent, YesNoModalComponent.options, {
      title: 'Confirmation needed',
      type: 'danger',
      message:
        '<p class="text-center">Are you sure you want to clear all data? If you click on "yes" all data related to the TranscriptionPortal is permanently removed.</p>',
    });
    const result = await ref.result;

    if (result === 'yes') {
      /* TODO add
      this.storage.clearAll();

       */
    }
  }

  onStartClick() {
    this.modeStoreService.startProcessing();
  }

  onFeedbackRequest(operation: StoreTaskOperation) {
    /*  TODO implement
    this.bugService.addEntry(
      ConsoleType.INFO,
      `user clicked on report issue:\n` + `operation: ${operation.name}, ${operation.state}\n` + `protocol: ${operation.protocol}\n`,
    );
    this.modalService.openFeedbackModal(); */
  }

  private readNewFiles(entries: (TPortalFileInfo | TPortalDirectoryInfo)[]) {
    this.preprocessingStoreService.addToQueue(entries);
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
    this.modeStoreService.changeMode(mode);
  }

  openAboutModal() {
    const ref = openModal<AboutModalComponent>(this.ngbModalService, AboutModalComponent, AboutModalComponent.options);
    return ref.result;
  }

  async backupDatabase() {
    /* TODO ADD
    this.dbBackup.url = await this.storage.backup();
    this.dbBackup.safeURL = this.sanitizer.bypassSecurityTrustResourceUrl(this.dbBackup.url);
    this.dbBackup.filename = `tportal_backup_${DateTime.now().toISO()}.idb`;
     */
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
        // TODO add await this.storage.importBackup(blob);
      }
    }

    restoreInput.files = null;
    restoreInput.value = '';
  }

  changeAccessCode(accessCode: string) {
    this.appStoreService.changeAccessCode(accessCode);
  }
}
