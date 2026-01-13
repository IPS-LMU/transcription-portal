import { AsyncPipe, NgClass, NgStyle, NgTemplateOutlet, UpperCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { openModal, ServiceProvider } from '@octra/ngx-components';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { Shortcut } from '@octra/web-media';
import * as clipboard from 'clipboard-polyfill';
import { DownloadModalComponent } from '../../modals/download-modal/download-modal.component';
import { FilePreviewModalComponent } from '../../modals/file-preview-modal/file-preview-modal.component';
import { LuxonFormatPipe } from '../../obj/luxon-format.pipe';
import { TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { ANIMATIONS } from '../../shared/Animations';
import { AppSettings } from '../../shared/app.settings';
import { ShortcutService } from '../../shared/shortcut.service';
import { TimePipe } from '../../shared/time.pipe';
import {
  ModeStoreService,
  OperationFactory,
  PreprocessingQueueItem,
  StoreAudioFile,
  StoreFile,
  StoreFileDirectory,
  StoreItem,
  StoreItemTask,
  StoreItemTaskDirectory,
  StoreTaskOperation,
  StoreTaskOperationProcessingRound,
  TaskStatus,
  TPortalModes,
} from '../../store';
import { getLastOperationResultFromLatestRound, getLastOperationRound } from '../../store/operation/operation.functions';
import { FileInfoTableComponent } from '../file-info-table/file-info-table.component';
import { OperationArrowComponent } from '../operation-arrow/operation-arrow.component';
import { PopoverComponent } from '../popover/popover.component';
import { ResultsTableComponent } from '../results-table/results-table.component';
import { ContextMenuComponent } from './context-menu/context-menu.component';
import { DirProgressDirective } from './directives/dir-progress.directive';
import { ProcColIconDirective } from './directives/proc-col-icon.directive';
import { ProceedingsRowDirective } from './directives/proceedings-row.directive';
import { ProceedingsTableTDDirective } from './directives/proceedings-table-td.directive';
import { ProceedingsTableOperationSelectorComponent } from './proceedings-table-operation-selector/proceedings-table-operation-selector.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProceedingTableNameColComponent } from './proceeding-table-name-col/proceeding-table-name-col.component';

@Component({
  selector: 'tportal-proceedings',
  templateUrl: './proceedings-table.component.html',
  styleUrls: ['./proceedings-table.component.scss'],
  animations: ANIMATIONS,
  imports: [
    PopoverComponent,
    ResultsTableComponent,
    FileInfoTableComponent,
    OperationArrowComponent,
    TimePipe,
    LuxonFormatPipe,
    NgbTooltip,
    NgStyle,
    NgClass,
    NgTemplateOutlet,
    ProceedingsTableTDDirective,
    ProceedingsTableOperationSelectorComponent,
    DirProgressDirective,
    ProcColIconDirective,
    ProceedingsRowDirective,
    AsyncPipe,
    ContextMenuComponent,
    TranslocoPipe,
    UpperCasePipe,
    ProceedingTableNameColComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProceedingsTableComponent extends SubscriberComponent implements OnDestroy, OnChanges {
  sanitizer = inject(DomSanitizer);
  cd = inject(ChangeDetectorRef);
  private ngbModalService = inject(NgbModal);
  private shortcutService = inject(ShortcutService);
  protected modeStoreService = inject(ModeStoreService);
  private elementRef = inject(ElementRef);

  public contextmenu = {
    x: 0,
    y: 0,
    hidden: true,
  };

  public popover: {
    x: number;
    y: number;
    state: string;
    width: number;
    height: number;
    lastOperationRound?: StoreTaskOperationProcessingRound;
    lastOperationRoundResult?: StoreFile;
    operation?: StoreTaskOperation;
    task?: StoreItemTask;
    directory?: StoreItemTaskDirectory;
    pointer: 'left' | 'right' | 'bottom-left' | 'bottom-right';
    mouseIn: boolean;
  } = {
    x: 0,
    y: 0,
    state: 'closed',
    width: 200,
    height: 320,
    pointer: 'left',
    mouseIn: false,
  };

  scrolling = {
    position: {
      x: 0,
      y: 0,
    },
    lastscroll: 0,
  };

  rightMouseButtonPressed = false;

  @Input() queue?: PreprocessingQueueItem[] | null;
  @Input() entries?: StoreItem[] | null;
  @Input() currentMode?: TPortalModes;
  @Input() operations?:
    | {
        factory: OperationFactory<any>;
        enabled: boolean;
      }[]
    | null = [];
  public isDragging = false;
  public allDirOpened: 'opened' | 'closed' = 'opened';
  @Input() shortstyle = false;
  @Input() isClosed = false;

  @Input() public set shortcutsEnabled(value: boolean) {
    if (value) {
      this.shortcutService.enableGroup('proceedings-table');
    } else {
      this.shortcutService.disableGroup('proceedings-table');
    }
  }

  @Output() public afterdrop = new EventEmitter<(TPortalFileInfo | TPortalDirectoryInfo)[]>();
  @Output() public operationclick: EventEmitter<{
    operation: StoreTaskOperation;
    task: StoreItemTask;
    opIndex: number;
    factory: OperationFactory;
  }> = new EventEmitter<{
    operation: StoreTaskOperation;
    task: StoreItemTask;
    opIndex: number;
    factory: OperationFactory;
  }>();
  @Output() public operationhover: EventEmitter<StoreTaskOperation> = new EventEmitter<StoreTaskOperation>();
  @Output() public feedbackRequested = new EventEmitter<StoreTaskOperation>();
  @ViewChild('inner', { static: true }) inner?: ElementRef;
  @ViewChild('popoverRef') public popoverRef?: PopoverComponent;
  @ViewChild('resultsTableComponent')
  public resultsTableComponent?: ResultsTableComponent;

  public selectedOperation?: OperationFactory;
  private readonly fileAPIsupported: boolean = false;
  private shiftStart = -1;
  private selectionBlocked = false;

  maxColumnWidths = [10, 15, 15, 15, 15, 10];

  private shortcuts: Shortcut[] = [];

  constructor() {
    super();
    // Check for the various FileInfo API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      this.fileAPIsupported = true;
    }

    this.initShortcuts();
  }

  private initShortcuts() {
    this.shortcuts = [
      {
        name: 'row-remove',
        label: 'row.remove',
        keys: {
          mac: 'CMD + BACKSPACE',
          pc: 'CTRL + BACKSPACE',
        },
        title: 'Remove row',
        callback: this.onShortcutRowRemove,
      },
      {
        name: 'rows-select-all',
        label: 'rows.select.all',
        keys: {
          mac: 'CMD + A',
          pc: 'CTRL + A',
        },
        title: 'Select all',
        callback: this.onShortcutRowsSelectAll,
        focusonly: true,
      },
    ];

    this.shortcutService.registerShortcutGroup({
      name: 'proceedings-table',
      enabled: true,
      items: this.shortcuts,
    });
  }

  public get d() {
    return Date.now();
  }

  ngOnChanges(changes: SimpleChanges): void {
    const entries = changes['entries'];
    if (entries) {
      const t = '';
    }
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this.cd.detach();
  }

  onDragOver($event: DragEvent) {
    $event.stopPropagation();
    $event.preventDefault();
    if ($event.dataTransfer) {
      $event.dataTransfer.dropEffect = 'copy';
    }
    this.isDragging = true;

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onTableScroll() {
    if (!this.rightMouseButtonPressed) {
      this.contextmenu.hidden = true;
    }
  }

  onTableMouseDown($event: MouseEvent) {
    this.rightMouseButtonPressed = $event.which === 3 || $event.button === 2;
  }

  onTableMouseUp() {
    this.rightMouseButtonPressed = false;
  }

  cancelScroll($event: Event) {
    $event.stopPropagation();
    $event.preventDefault();
  }

  onDrop($event: DragEvent) {
    $event.stopPropagation();
    $event.preventDefault();
    this.isDragging = false;

    const promises: Promise<void>[] = [];

    if (this.fileAPIsupported) {
      if ($event.dataTransfer) {
        const droppedfiles = $event.dataTransfer.items;
        const files: (TPortalFileInfo | TPortalDirectoryInfo)[] = [];

        for (let i = 0; i < droppedfiles.length; i++) {
          const item = droppedfiles[i].webkitGetAsEntry();
          if (item !== null) {
            if (item.isDirectory) {
              // TODO fix order!
              promises.push(
                new Promise<void>((resolve, reject) => {
                  TPortalDirectoryInfo.fromFolderObject<any, TPortalFileInfoAttributes>(item)
                    .then((dir) => {
                      // check added directory
                      files.push(dir as TPortalDirectoryInfo);
                      resolve();
                    })
                    .catch((error) => {
                      this.afterdrop.error(error);
                      reject();
                    });
                }),
              );
            } else {
              // check added file
              const file = droppedfiles[i].getAsFile();
              if (!(file === null || file === undefined)) {
                // check file
                if (file.name.indexOf('.') > -1) {
                  files.push(TPortalFileInfo.fromFileObject(file) as TPortalFileInfo);
                  this.cd.markForCheck();
                  this.cd.detectChanges();
                }
              } else {
                this.afterdrop.error(`could not read file from webKitFile`);
              }
            }
          }
        }
        if (promises.length > 0) {
          Promise.all(promises).then(() => {
            this.afterdrop.emit(files);
            this.cd.markForCheck();
            this.cd.detectChanges();
          });
        } else {
          this.afterdrop.emit(files);
        }
      }
    } else {
      this.afterdrop.error(`file api not supported`);
    }
  }

  onContextBlur() {
    this.contextmenu.hidden = true;
    this.cd.markForCheck();
  }

  cancelContextMenu($event: MouseEvent) {
    if (!this.contextmenu.hidden) {
      $event.preventDefault();
    }
  }

  onContextMenu($event: MouseEvent, row: HTMLTableRowElement, container: HTMLDivElement) {
    $event.preventDefault();
    $event.stopPropagation();

    const task = this.popover.task ?? this.popover.directory;
    if (task) {
      this.modeStoreService.selectRows([task.id], !task.selected);
    }
    this.contextmenu.x = $event.x - 20;
    this.contextmenu.y = row.offsetTop - row.offsetHeight - this.inner?.nativeElement.scrollTop;
    const elem = this.elementRef.nativeElement as HTMLElement;
    if (this.contextmenu.y + container.offsetHeight + 100 >= elem.offsetHeight) {
      this.contextmenu.y -= container.offsetHeight;
    }
    this.contextmenu.hidden = false;
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onRowSelected(entry: StoreItem, operationIndex?: number, operation?: StoreTaskOperation) {
    if (!this.selectionBlocked) {
      if (!operation || !['OCTRA', 'Emu WebApp'].includes(operation.name)) {
        const indexFromTaskList = (this.entries ?? []).findIndex((a: StoreItem) => a.id === entry.id);
        const pressedKeys = this.shortcutService.pressedKeys;

        if (pressedKeys.has('ctrl') || pressedKeys.has('cmd')) {
          // de-/selection

          if (entry.selected) {
            // deselect
            this.modeStoreService.deselectRows([entry.id]);
          } else {
            // select
            this.modeStoreService.selectRows([entry.id]);
          }
        } else {
          if (pressedKeys.has('shift')) {
            // shift selection
            // shift pressed
            if (this.shiftStart > -1) {
              let end = indexFromTaskList;

              if (this.shiftStart > end) {
                const temp = this.shiftStart;
                this.shiftStart = end;
                end = temp;
              }

              const selectedRowsIndices: number[] = [];
              for (let i = this.shiftStart; i <= end; i++) {
                selectedRowsIndices.push(i);
              }
              this.modeStoreService.setSelectedRowsByIndex(selectedRowsIndices);
              // select all between
              // const start =x
              this.shiftStart = -1;
            }
          } else {
            // TODO check this
            this.shiftStart = indexFromTaskList;
            this.modeStoreService.selectRows([entry.id], true);
          }
        }
      }

      const previousOperation =
        operationIndex && operation && operationIndex > 0 ? (entry as StoreItemTask).operations[operationIndex - 1] : undefined;
      const previousOperationLastResult = previousOperation ? getLastOperationResultFromLatestRound(previousOperation) : undefined;

      if ((previousOperation && previousOperationLastResult?.online) || (operation && previousOperationLastResult?.online)) {
        this.operationclick.emit({
          operation: operation as any,
          task: entry as any,
          opIndex: operationIndex!,
          factory: this.operations![operationIndex!].factory,
        });
        console.log('row selected close');
        this.popover.state = 'closed';
      }

      this.cd.markForCheck();
      this.cd.detectChanges();
    }
  }

  onContextMenuOptionSelected(option: string) {
    if (option === 'delete') {
      this.deleteSelectedTasks();
    } else if (option === 'appendings-remove') {
      this.removeAppending();
    } else if (option === 'download') {
      this.openArchiveDownload('line', this.selectedOperation);
    }
    this.contextmenu.hidden = true;
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  removeAppending() {
    this.modeStoreService.removeAppendingForSelectedItems();
  }

  togglePopover(show: boolean) {
    if (show) {
      this.popover.state = 'opened';
    } else if (!this.resultsTableComponent?.somethingClicked) {
      this.popover.state = 'closed';
    }

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onOperationMouseEnter($event: MouseEvent, task: StoreItemTask, operation: StoreTaskOperation, td: HTMLTableCellElement) {
    // show Popover for normal operations only
    const lastRound = getLastOperationRound(operation);
    if (!(lastRound?.status === TaskStatus.PENDING || lastRound?.status === TaskStatus.SKIPPED || lastRound?.status === TaskStatus.READY)) {
      const icon: HTMLElement = $event.target as HTMLElement;
      const parentNode = td;

      if (parentNode && this.popoverRef && this.inner) {
        this.popover.operation = operation;
        this.popover.lastOperationRound = getLastOperationRound(operation);
        this.popover.lastOperationRoundResult = getLastOperationResultFromLatestRound(operation);

        if (operation.protocol) {
          this.popover.width = 500;
        } else {
          this.popover.width = 400;
        }
        this.popover.height = 230;
        if (parentNode.offsetLeft + this.popover.width < window.innerWidth - 100) {
          this.popover.x = parentNode.offsetLeft + parentNode.offsetWidth / 2;
          this.popover.pointer = $event.clientY + this.popoverRef.height + 20 > window.innerHeight ? 'bottom-left' : 'left';
        } else {
          this.popover.x = parentNode.offsetLeft - this.popover.width + parentNode.offsetWidth / 2;
          this.popover.pointer = $event.clientY + this.popoverRef.height + 20 < window.innerHeight ? 'right' : 'bottom-right';
        }
        this.updateChanges();

        const top =
          icon.offsetTop +
          parentNode.offsetTop +
          this.inner.nativeElement.parentElement.parentElement.parentElement.parentElement.parentElement.offsetTop -
          this.inner.nativeElement.scrollTop +
          icon.offsetHeight;
        this.popover.y = top + this.popoverRef.height + 20 > window.innerHeight ? top - this.popover.height - icon.offsetHeight + 10 : top;
      }

      this.popover.task = task;
      this.updateChanges();
      this.togglePopover(true);
    } else {
      this.popover.task = undefined;
    }
  }

  onOperationMouseLeave($event: MouseEvent, operation: StoreTaskOperation) {
    this.popover.mouseIn = false;
    setTimeout(() => {
      if (!this.popover.mouseIn) {
        this.togglePopover(false);
      }
    }, 250);
  }

  onOperationMouseOver($event: MouseEvent, task: StoreItemTask, operation: StoreTaskOperation, operationIndex: number) {
    this.popover.mouseIn = true;
    this.popover.task = task;
    this.popover.operation = operation;
    this.selectedOperation = this.operations![operationIndex].factory;
    this.operationhover.emit();
  }

  onNameMouseEnter($event: MouseEvent, entry?: StoreItem) {
    if (!entry) {
      return;
    }
    if (entry.type === 'task') {
      this.popover.directory = undefined;
      this.popover.task = entry as StoreItemTask;
    } else {
      this.popover.task = undefined;
      this.popover.directory = entry as StoreItemTaskDirectory;
    }
    this.popover.operation = undefined;
    this.popover.lastOperationRound = undefined;
    this.popover.lastOperationRoundResult = undefined;
  }

  onNameMouseLeave($event: MouseEvent, entry?: StoreItem) {
    if (!entry) {
      return;
    }
  }

  onNameMouseOver($event: MouseEvent, entry?: StoreItem) {
    if (!entry) {
      return;
    }
  }

  onInfoMouseEnter($event: MouseEvent, task?: StoreItemTask) {
    if (!task) {
      return;
    }
    // show Popover for normal operations only
    if (this.popoverRef) {
      const y = $event.clientY + 10;
      this.popover.task = task;
      this.popover.x = $event.clientX + 10;
      this.popover.width = 600;
      this.popover.height = 320;
      this.popover.pointer = y + this.popoverRef.height > window.innerHeight ? 'bottom-left' : 'left';
      this.popover.y = y + this.popoverRef.height > window.innerHeight ? y - this.popoverRef.height - 10 : y;

      this.popover.operation = undefined;
      this.popover.lastOperationRound = undefined;
      this.popover.lastOperationRound = undefined;
      this.popover.lastOperationRoundResult = undefined;
      this.togglePopover(true);
    }
  }

  onInfoMouseLeave($event: MouseEvent, task?: StoreItemTask) {
    this.popover.mouseIn = false;
    setTimeout(() => {
      if (!this.popover.mouseIn) {
        this.togglePopover(false);
      }
    }, 250);
  }

  onInfoMouseOver($event: MouseEvent, task?: StoreItemTask) {
    this.popover.mouseIn = true;
    if (!task) {
      return;
    }
  }

  calculateDuration(time: { start: number; duration?: number } | undefined, operation: StoreTaskOperation) {
    const lastRound = getLastOperationRound(operation);
    if (lastRound?.status === TaskStatus.PROCESSING && lastRound?.time) {
      return (lastRound.time.duration ?? 0) + Math.max(0, Date.now() - lastRound.time.start);
    } else if (time) {
      if (time.duration && time.duration > 0) {
        return time.duration;
      }
    }
    return 0;
  }

  public getPopoverColor(operation: StoreTaskOperation): string {
    if (operation) {
      const lastRound = getLastOperationRound(operation);
      if (
        lastRound?.status === TaskStatus.ERROR ||
        (lastRound?.status === TaskStatus.FINISHED &&
          !(getLastOperationResultFromLatestRound(operation)?.online || getLastOperationResultFromLatestRound(operation)?.content))
      ) {
        return 'red';
      } else if (lastRound?.status === TaskStatus.FINISHED && operation.protocol) {
        return '#ffc33b';
      }
    }
    return '#3a70dd';
  }

  public onOperationClick($event: MouseEvent, operation: StoreTaskOperation, index: number, task: StoreItemTask) {
    if (operation.name === 'OCTRA' || operation.name === 'Emu WebApp') {
      this.popover.state = 'closed';
      this.cd.markForCheck();
      this.cd.detectChanges();
      this.selectedOperation = undefined;
    } else {
      this.selectedOperation = this.operations![index].factory;
    }
    if (operation.enabled && getLastOperationRound(operation)?.status !== TaskStatus.SKIPPED) {
      this.operationclick.emit({
        operation,
        opIndex: index,
        factory: this.operations![index].factory,
        task,
      });
    }
  }

  openArchiveDownload(type: 'column' | 'line', operation: OperationFactory | undefined) {
    if (operation && operation.name !== 'Upload') {
      this.selectedOperation = operation;
      this.openDownloadModal(type);
    } else if (type === 'line') {
      this.openDownloadModal(type);
    }
  }

  openDownloadModal(type: 'column' | 'line') {
    const ref = this.ngbModalService.open(DownloadModalComponent, DownloadModalComponent.options);
    ref.componentInstance.type = type;
    ref.componentInstance.column = this.selectedOperation;
  }

  onShortcutRowRemove = () => {
    this.popover.state = 'closed';
    this.deleteSelectedTasks();
    this.cd.markForCheck();
  };

  onShortcutRowsSelectAll = () => {
    this.modeStoreService.toggleSelectionForAllRows();
  };

  public removeEntry(event: MouseEvent, entry: StoreItem) {
    if (entry) {
      this.modeStoreService.removeStoreItems([entry.id]);
    }
  }

  public onPreviewClick(file: TPortalFileInfo) {
    this.popover.state = 'closed';
    this.cd.markForCheck();
    const ref = openModal<FilePreviewModalComponent>(this.ngbModalService, FilePreviewModalComponent, FilePreviewModalComponent.options);
    ref.componentInstance.selectedFile = file;
    if (file.file) {
      const url = URL.createObjectURL(file.file!);
      ref.componentInstance.downloadURL = this.sanitizer.bypassSecurityTrustResourceUrl(url);
      ref.result.then(() => {
        URL.revokeObjectURL(url);
      });
    } else if (file.url) {
      ref.componentInstance.downloadURL = file.url;
    }
  }

  onTagClicked(dirID: number) {
    this.modeStoreService.toggleDirectoryOpened(dirID);
  }

  onOpenAllRows() {
    if (this.allDirOpened === 'opened') {
      this.allDirOpened = 'closed';
    } else {
      this.allDirOpened = 'opened';
    }
  }

  toolTipAction(action: string, tooltip: any) {
    if (action === 'open') {
      tooltip.open();
    } else {
      tooltip.close();
    }

    this.updateChanges();
  }

  copyProtocolToClipboard(protocol?: string) {
    if (protocol) {
      clipboard.writeText(protocol);
    }
  }

  onReportIconClick(operation: StoreTaskOperation) {
    this.feedbackRequested.emit(operation);
  }

  public updateChanges() {
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  private deleteSelectedTasks() {
    this.modeStoreService.removeStoreItems((this.entries ?? []).filter((a) => a.selected).map((a) => a.id));
  }

  onExportButtonClick(task: StoreItem, rowIndex: number, operation?: OperationFactory) {
    const selectedRows = [rowIndex];
    // this.selectedOperation = operation;
    this.openArchiveDownload('line', operation);
  }

  isOneOperationFinished(entry: StoreItem): boolean {
    if (entry) {
      const checkTask = (task: StoreItemTask) => {
        for (const operation of task.operations) {
          if (operation.name !== 'Upload') {
            const lastRound = getLastOperationRound(operation);
            if (lastRound?.status === TaskStatus.FINISHED || operation.rounds.length > 0) {
              return true;
            }
          }
        }
        return false;
      };

      if (entry.type === 'task') {
        return checkTask(entry as StoreItemTask);
      } else {
        const dir = entry as StoreItemTaskDirectory;
        for (const index of dir.entries.ids) {
          if (checkTask(dir.entries.entities[index] as StoreItemTask)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  public getDirEntriesFromItem(entry: PreprocessingQueueItem): (StoreFile | StoreAudioFile)[] {
    if (entry.infoItem?.type === 'folder') {
      return (entry.infoItem as StoreFileDirectory).entries as (StoreFile | StoreAudioFile)[];
    }
    return [];
  }

  public getTaskDirEntries(entry: StoreItem): StoreItemTask[] {
    if (entry.type === 'folder') {
      return Object.keys((entry as StoreItemTaskDirectory).entries.entities).map(
        (a) => (entry as StoreItemTaskDirectory).entries.entities[a],
      ) as StoreItemTask[];
    }
    return [];
  }

  public getFileInfo(entry: PreprocessingQueueItem) {
    return entry.infoItem?.type !== 'folder' ? (entry.infoItem as TPortalFileInfo) : undefined;
  }

  public getTaskDirectory(entry: StoreItem): StoreItemTaskDirectory | undefined {
    if (entry.type === 'folder') {
      return entry as StoreItemTaskDirectory;
    }
    return undefined;
  }

  public getTask(entry: StoreItem): StoreItemTask | undefined {
    if (entry.type === 'task') {
      return entry as StoreItemTask;
    }
    return undefined;
  }

  getServerProvider(basName?: string): ServiceProvider | undefined {
    return AppSettings.getServiceInformation(basName);
  }

  onOperationTDMouseEnter(entry: StoreItem) {
    if (entry.type === 'task') {
      this.popover.directory = undefined;
      this.popover.task = entry as StoreItemTask;
    } else {
      this.popover.task = undefined;
      this.popover.directory = entry as StoreItemTaskDirectory;
    }
  }

  protected getAudioFileOfTask(task: StoreItemTask) {
    return undefined;
  }

  protected readonly getLastOperationRound = getLastOperationRound;
}
