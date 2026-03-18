import { AsyncPipe, DatePipe, NgClass, NgStyle, UpperCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, HostListener, inject, OnDestroy, Renderer2, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
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
import { ConsoleEntry, ConsoleGroupEntry, ConsoleLoggingService, ConsoleType } from '@octra/ngx-components';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { hasProperty } from '@octra/utilities';
import { environment } from '../../../environments/environment';
import { AppInfo } from '../../app.info';
import { AlertComponent } from '../../components/alert/alert.component';
import { ProceedingsTableComponent } from '../../components/proceedings-table/proceedings-table.component';
import { ToolLoaderComponent } from '../../components/tool-loader/tool-loader.component';
import { AboutModalComponent } from '../../modals/about-modal/about-modal.component';
import { QueueModalComponent } from '../../modals/queue-modal/queue-modal.component';
import { StatisticsModalComponent } from '../../modals/statistics-modal/statistics-modal.component';
import { YesNoModalComponent } from '../../modals/yes-no-modal/yes-no-modal.component';
import { openModal } from '../../obj/functions';
import { TPortalDirectoryInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { RoutingService } from '../../routing.service';
import { NotificationService } from '../../shared/notification.service';
import { OHModalService } from '../../shared/ohmodal.service';
import { TimePipe } from '../../shared/time.pipe';
import {
  AppStoreService,
  IDBStoreService,
  ModeStoreService,
  OperationFactory,
  PreprocessingStoreService,
  StoreAudioFile,
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
  imports: [
    AlertComponent,
    NgClass,
    FormsModule,
    NgStyle,
    ToolLoaderComponent,
    NgbCollapse,
    NgbTooltip,
    NgbDropdown,
    NgbDropdownMenu,
    NgbDropdownToggle,
    NgbNavModule,
    NgbPopover,
    DatePipe,
    TranslocoPipe,
    UpperCasePipe,
    AsyncPipe,
    TimePipe,
    ProceedingsTableComponent,
  ],
})
export class MainComponent extends SubscriberComponent implements OnDestroy {
  protected ngbModalService = inject(NgbModal);
  protected httpClient = inject(HttpClient);
  protected notification = inject(NotificationService);
  protected consoleLoggingService = inject(ConsoleLoggingService);
  protected idbStoreService = inject(IDBStoreService);
  protected modalService = inject(OHModalService);
  protected appStoreService = inject(AppStoreService);
  protected modeStoreService = inject(ModeStoreService);
  protected preprocessingStoreService = inject(PreprocessingStoreService);
  protected renderer = inject(Renderer2);
  protected route = inject(ActivatedRoute);
  protected routingService = inject(RoutingService);

  isCollapsed = false;
  public test = 'inactive';
  public dragborder = 'inactive';
  public newProceedingsWidth = 30;
  public newToolWidth = 70;
  public settingsCollapsed = true;
  public accessCodeInputFieldType: 'password' | 'text' = 'password';
  protected toolSelectedOperation?:
    | {
        operation: StoreTaskOperation<any, StoreTaskOperation<any, any>> | undefined;
        language: string;
        audioFile: StoreAudioFile;
        url: string;
      }
    | undefined;

  activeMode = 1;

  @ViewChild('fileinput') fileinput?: ElementRef;
  @ViewChild('proceedings') proceedings?: ProceedingsTableComponent;

  public get errorsFound(): boolean {
    let beginCheck = false;
    return (
      this.consoleLoggingService.console.filter((a) => {
        const hasError = (b: ConsoleEntry) => {
          if (b.type === ConsoleType.ERROR && beginCheck) {
            return true;
          }
          if (typeof b.message === 'string' && b.message.indexOf('AFTER RELOAD') > -1) {
            beginCheck = true;
          }
          return false;
        };

        if (Object.keys(a).includes('label') || Object.keys(a).includes('entries')) {
          for (const entry of (a as ConsoleGroupEntry).entries) {
            if (hasError(entry)) {
              return true;
            }
          }
          return false;
        } else {
          return hasError(a as ConsoleEntry);
        }
      }).length > 0
    );
  }

  constructor() {
    super();
    this.subscribe(this.modeStoreService.openedToolOperation$, {
      next: (toolOperation) => {
        this.toolSelectedOperation = toolOperation;
      },
    });
    this.subscribe(this.route.url, {
      next: (url) => {
        if (url.length > 0) {
          if (url[0].path === 'annotation') {
            this.modeStoreService.changeMode('annotation');
          } else if (url[0].path.includes('summarization')) {
            this.modeStoreService.changeMode('summarization');
          }
        }
      },
    });
  }

  public get isdevelopment(): boolean {
    return environment.development;
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
    this.appStoreService.setShortcutsEnabled(false);
    const ref = openModal<QueueModalComponent>(this.ngbModalService, QueueModalComponent, QueueModalComponent.options);
    await ref.result;
    this.appStoreService.setShortcutsEnabled(true);
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

  async onOperationClick({ operation, task }: { operation: StoreTaskOperation; task: StoreItemTask; opIndex: number; factory: OperationFactory }) {
    if (
      operation &&
      ['OCTRA', 'Emu WebApp'].includes(operation.name) &&
      getLastOperationRound(operation)?.status !== TaskStatus.PENDING &&
      operation.taskID
    ) {
      this.modeStoreService.openOperationWithTool(operation, task);
    }
  }

  onOperationHover(operation: StoreTaskOperation) {}

  getShortCode(code: string) {
    return code.substring(code.length - 2);
  }

  onToolDataReceived(data: any) {
    const $event = data.event;
    if ($event.data.data !== undefined && hasProperty($event.data, 'data')) {
      (async () => {
        if (data.name === 'OCTRA') {
          if (hasProperty($event.data, 'status') && $event.data.status === 'success' && hasProperty($event.data.data, 'annotation')) {
            this.modeStoreService.receiveToolData($event.data);
          }
        } else if (data.name === 'Emu WebApp') {
          this.modeStoreService.receiveToolData({
            status: 'success',
            data: {
              annotation: {
                name: $event.data.data.annotation.name + '_annot.json',
                content: JSON.stringify($event.data.data.annotation, null, 2),
                type: 'application/json',
                encoding: 'utf-8',
              },
            },
          });
        }
      })();
    }
  }

  onBackButtonClicked() {
    this.modeStoreService.closeToolLoader();
  }

  @HostListener('window:beforeunload', ['$event'])
  doSomething($event: Event) {
    if (environment.debugging.enabled) {
      return 'Are you sure you want to leave the TranscriptionPortal? Maybe running processes are going to be canceled.';
    }
    return '';
  }

  public dragBorder($event: any, part: string) {
    console.log(
      `drag ${this.dragborder} ${$event.type}, part: ${part}, ${this.dragborder}, pageX: ${$event.pageX}, pageY: ${$event.pageY}, clientWIdth: ${$event.target.clientWidth}`,
    );

    if ($event.type === 'mouseleave') {
      this.dragborder = 'inactive';
      this.renderer.setStyle($event.target, 'width', '10px');
      this.renderer.setStyle($event.target, 'margin-left', '');
    } else if (this.dragborder !== 'dragging') {
      this.renderer.setStyle($event.target, 'width', '120px');
      this.renderer.setStyle($event.target, 'margin-left', 'calc(var(--proceedings-width) - 60px)');
      this.dragborder = 'active';
    }

    if (this.dragborder === 'dragging' && $event.type === 'mousemove') {
      // dragging
      const procWidth = Math.floor((($event.pageX + 10) / window.innerWidth) * 100);
      const toolWidth = 100 - procWidth;

      this.newToolWidth = toolWidth;
      this.newProceedingsWidth = procWidth;
      this.appStoreService.changeSidebarWidth(this.newProceedingsWidth);
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
        console.log(`stop dragging ${$event.type}, part: ${part}`);
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
      this.idbStoreService.clearDatabase();
    }
  }

  onStartClick() {
    this.modeStoreService.toggleProcessing();
  }

  onFeedbackRequest(operation: StoreTaskOperation) {
    this.consoleLoggingService.addEntry(
      ConsoleType.INFO,
      `user clicked on report issue:\n` +
        `operation: ${operation.name}, ${getLastOperationRound(operation)?.status}\n` +
        `protocol: ${operation.protocol}\n`,
    );
    this.modalService.openFeedbackModal();
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
    this.appStoreService.setShortcutsEnabled(false);
    const ref = this.ngbModalService.open(StatisticsModalComponent, StatisticsModalComponent.options);
    try {
      await ref.result;
      this.appStoreService.setShortcutsEnabled(true);
    } catch (error) {
      this.appStoreService.setShortcutsEnabled(true);
    }
  }

  changeMode(mode: 'annotation' | 'summarization') {
    this.routingService.navigate(
      'change mode',
      [mode],
      {
        queryParams: {
          mode: null,
        },
      },
      'replace',
    );
  }

  openAboutModal() {
    const ref = openModal<AboutModalComponent>(this.ngbModalService, AboutModalComponent, AboutModalComponent.options);
    this.appStoreService.setShortcutsEnabled(false);
    ref.result.then(() => {
      this.appStoreService.setShortcutsEnabled(true);
    });
  }

  async backupDatabase() {
    this.idbStoreService.backupDatabase();
  }

  onSettingsDropdownChange(opened: boolean) {
    if (!opened) {
      this.idbStoreService.revokeDatabaseBackupURL();
    }
  }

  async onRestoreFileSelected(restoreInput: HTMLInputElement) {
    if (restoreInput.files && restoreInput.files.length === 1) {
      const blob = restoreInput.files.item(0);
      if (blob) {
        this.idbStoreService.restoreDatabase(blob);
      }
    }

    restoreInput.files = null;
    restoreInput.value = '';
  }

  changeAccessCode(accessCode: string) {
    this.appStoreService.changeAccessCode(accessCode);
  }
}
