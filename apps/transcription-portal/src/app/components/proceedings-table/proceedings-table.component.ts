import { AsyncPipe, NgClass, NgStyle, NgTemplateOutlet } from '@angular/common';
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
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { NgbModal, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { ServiceProvider } from '@octra/ngx-components';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { Shortcut, ShortcutGroup } from '@octra/web-media';
import * as clipboard from 'clipboard-polyfill';
import { HotkeysEvent } from 'hotkeys-js';
import { DownloadModalComponent } from '../../modals/download-modal/download-modal.component';
import { FilePreviewModalComponent } from '../../modals/file-preview-modal/file-preview-modal.component';
import { LuxonFormatPipe } from '../../obj/luxon-format.pipe';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { ANIMATIONS } from '../../shared/Animations';
import { AppSettings } from '../../shared/app.settings';
import { ShortcutService } from '../../shared/shortcut.service';
import { TimePipe } from '../../shared/time.pipe';
import { StorageService } from '../../storage.service';
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
import { DirProgressDirective } from './directives/dir-progress.directive';
import { ProcColIconDirective } from './directives/proc-col-icon.directive';
import { ProceedingsRowDirective } from './directives/proceedings-row.directive';
import { ProceedingsTableTDDirective } from './directives/proceedings-table-td.directive';
import { ProceedingsTableOperationSelectorComponent } from './proceedings-table-operation-selector/proceedings-table-operation-selector.component';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class ProceedingsTableComponent extends SubscriberComponent implements OnInit, OnDestroy, OnChanges {
  sanitizer = inject(DomSanitizer);
  cd = inject(ChangeDetectorRef);
  storage = inject(StorageService);
  private ngbModalService = inject(NgbModal);
  private shortcutService = inject(ShortcutService);
  protected modeStoreService = inject(ModeStoreService);

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

  ngOnInit() {}

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
      // TODO check browser support
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

  onContextMenu($event: MouseEvent, row: HTMLTableRowElement) {
    $event.preventDefault();
    $event.stopPropagation();

    /* TODO ADD
    const task = this.popover.task ?? this.popover.directory;
    const taskList = this.taskService.state.currentModeState.taskList;

    if (task && taskList && this.taskService.currentModeState) {
      if (this.taskService.currentModeState.selectedRows.length <= 1) {
        this.taskService.currentModeState.selectedRows = [];
        const index = getIndexByEntry(task, this.entries ?? []);
        this.taskService.currentModeState.selectedRows.push(index);
      }
      this.contextmenu.x = $event.x - 20;
      this.contextmenu.y = row.offsetTop - row.offsetHeight - this.inner?.nativeElement.scrollTop;
      this.contextmenu.hidden = false;
      this.cd.markForCheck();
      this.cd.detectChanges();

    }
     */
  }

  onRowSelected(entry: StoreItem, operationIndex?: number, operation?: StoreTaskOperation) {
    /* TODO ADD
    if (!this.selectionBlocked) {
      const taskList = this.taskService.state.currentModeState.taskList;
      if (!operation || (!['OCTRA', 'Emu WebApp'].includes(operation.name) && taskList && this.taskService.currentModeState)) {
        const indexFromTaskList = (this.entries ?? []).findIndex((a: StoreItem) => a.id === entry.id);
        const pressedKeys = this.shortcutService.pressedKeys;

        if (pressedKeys.has('ctrl') || pressedKeys.has('cmd')) {
          // de-/selection

          if (entry.selected) {
            // deselect
            this.modeStoreService.deselectRows([entry.id]);
          } else {
            // select
            this.modeStoreService.deselectRows([entry.id]);
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

              const selectedRows: number[] = [];
              for (let i = this.shiftStart; i <= end; i++) {
                selectedRows.push(i);
              }
              this.modeStoreService.setSelectedRows(selectedRows);
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
     */
  }

  onContextMenuOptionSelected(option: string) {
    if (option === 'delete') {
      this.deleteSelectedTasks();
    } else if (option === 'appendings-remove') {
      this.removeAppendings();
    } else if (option === 'download') {
      // TODO ADD this.openArchiveDownload('line', this.selectedOperation, this.taskService.currentModeState.selectedRows);
    }
    this.contextmenu.hidden = true;
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  removeAppendings() {
    /*
    const taskList = this.taskService.state.currentModeState.taskList;
    if (taskList && this.taskService.currentModeState) {
      for (const index of this.taskService.currentModeState.selectedRows) {
        const entry = taskList.getEntryByIndex(index);
        if (entry instanceof Task) {
          if (entry && entry.files.length > 1) {
            entry.files.splice(1);
            entry.operations[1].enabled = this.taskService.state.currentModeState.operations[1].enabled;
            entry.operations[1].changeState(entry.status);
          }
        } else {
          if (entry) {
            for (const entryElem of entry.entries) {
              const task = entryElem as Task;
              if (task.files.length > 1) {
                task.files.splice(1);
                task.operations[1].enabled = this.taskService.state.currentModeState.operations[1].enabled;
                task.operations[1].changeState(task.status);
              }
            }
          }
        }
      }
    }

     */
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
      this.togglePopover(true);

      this.popover.lastOperationRound = undefined;
      this.popover.lastOperationRound = undefined;
      this.popover.lastOperationRoundResult = undefined;
    }
  }

  onInfoMouseLeave($event: MouseEvent, task?: StoreItemTask) {
    if (!task) {
      return;
    }
    this.togglePopover(false);
    // TODO check task.mouseover = false;
  }

  onInfoMouseOver($event: MouseEvent, task?: StoreItemTask) {
    if (!task) {
      return;
    }
    // TODO check task.mouseover = true;
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
          !(getLastOperationResultFromLatestRound(operation)?.online || getLastOperationResultFromLatestRound(operation)?.blob))
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
      console.log('operation click selected close');
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

  openArchiveDownload(type: 'column' | 'line', operation: OperationFactory | undefined, selectedLines: number[]) {
    if (operation !== null && operation !== undefined && operation.name !== 'Upload') {
      this.selectedOperation = operation;
      this.openDownloadModal(type, selectedLines);
    } else if (type === 'line') {
      this.openDownloadModal(type, selectedLines);
    }
  }

  openDownloadModal(type: 'column' | 'line', selectedLines: number[]) {
    const ref = this.ngbModalService.open(DownloadModalComponent, DownloadModalComponent.options);
    ref.componentInstance.type = type;
    ref.componentInstance.column = this.selectedOperation;
    ref.componentInstance.selectedTasks = selectedLines;
  }

  onShortcutRowRemove = () => {
    this.popover.state = 'closed';
    this.deleteSelectedTasks();
    this.cd.markForCheck();
  };

  onShortcutRowsSelectAll = () => {
    /* TODO add
    this.taskService.currentModeState!.selectedRows = [];
    if (!this.taskService.currentModeState!.allSelected) {
      // select all
      const length = this.taskService.state.currentModeState.taskList?.length ?? 0;

      for (let i = 0; i < length; i++) {
        this.taskService.currentModeState!.selectedRows.push(i);
      }
      this.taskService.currentModeState!.allSelected = true;
    } else {
      this.taskService.currentModeState!.allSelected = false;
    }

     */
  };

  public removeEntry(event: MouseEvent, entry: StoreItem) {
    if (entry) {
      this.modeStoreService.removeStoreItems([entry.id]);
    }
  }

  public onPreviewClick(file: TPortalFileInfo) {
    console.log('preview click close');
    this.popover.state = 'closed';
    this.cd.markForCheck();
    const ref = this.ngbModalService.open(FilePreviewModalComponent, FilePreviewModalComponent.options);
    ref.componentInstance.selectedFile = file;
    ref.componentInstance.downloadURL = this.sanitizer.bypassSecurityTrustResourceUrl(URL.createObjectURL(file.file!));
    ref.result.then(() => {
      URL.revokeObjectURL((ref.componentInstance.downloadURL as any).changingThisBreaksApplicationSecurity);
    });
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
    /* TOOD ADD
    const removeQueue = [];
    const taskList = this.taskService.state.currentModeState.taskList;
    if (taskList && this.taskService.currentModeState) {
      for (const index of this.taskService.currentModeState.selectedRows) {
        const entry = taskList.getEntryByIndex(index);

        let dirFound = false;
        if (entry instanceof Task && !(entry.directory === null || entry.directory === undefined)) {
          const dirIndex = taskList.getIndexByEntry(entry.directory);

          // found folder?
          dirFound =
            this.taskService.currentModeState.selectedRows.findIndex((a) => {
              return a === dirIndex;
            }) > -1;
        }

        if (entry === null) {
          console.error(`can't remove! entry is null!`);
        }

        if (!dirFound && entry !== null) {
          removeQueue.push(entry);
        }
      }
    }

    for (const entry of removeQueue) {
      this.taskService.state.currentModeState.taskList?.removeEntry(entry, true).catch((error) => {
        console.error(error);
      });
    }

    this.taskService.currentModeState!.selectedRows = [];
    this.shiftStart = -1;
    this.cd.markForCheck();

     */
  }

  onExportButtonClick(task: StoreItem, rowIndex: number, operation?: OperationFactory) {
    const selectedRows = [rowIndex];
    // this.selectedOperation = operation;
    this.openArchiveDownload('line', operation, selectedRows);
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

  getAudioFileOfTask(task: StoreItemTask): TPortalAudioInfo | undefined {
    if (task.files.length > 0 && task.files[0].type.includes('audio')) {
      return task.files[0] as TPortalAudioInfo;
    }
    return undefined;
  }

  getServerProvider(basName?: string): ServiceProvider | undefined {
    return AppSettings.getServiceInformation(basName);
  }

  protected readonly name = name;
}

export default ProceedingsTableComponent;
