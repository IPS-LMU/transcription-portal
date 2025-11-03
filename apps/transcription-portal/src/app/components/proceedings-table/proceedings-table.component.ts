import { NgClass, NgStyle, NgTemplateOutlet } from '@angular/common';
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
import { SubscriberComponent } from '@octra/ngx-utilities';
import { Shortcut, ShortcutGroup } from '@octra/web-media';
import * as clipboard from 'clipboard-polyfill';
import { HotkeysEvent } from 'hotkeys-js';
import { DownloadModalComponent } from '../../modals/download-modal/download-modal.component';
import { FilePreviewModalComponent } from '../../modals/file-preview-modal/file-preview-modal.component';
import { LuxonFormatPipe } from '../../obj/luxon-format.pipe';
import { ASROperation } from '../../obj/operations/asr-operation';
import { G2pMausOperation } from '../../obj/operations/g2p-maus-operation';
import { Operation } from '../../obj/operations/operation';
import { SummarizationOperation } from '../../obj/operations/summarization-operation';
import { TranslationOperation } from '../../obj/operations/translation-operation';
import { QueueItem } from '../../obj/preprocessor';
import { Task, TaskDirectory, TaskList, TaskStatus } from '../../obj/tasks';
import { TaskService } from '../../obj/tasks/task.service';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { ANIMATIONS } from '../../shared/Animations';
import { ShortcutService } from '../../shared/shortcut.service';
import { TimePipe } from '../../shared/time.pipe';
import { StorageService } from '../../storage.service';
import { getIndexByEntry, ModeStoreService, OperationFactory, StoreTask, StoreTaskDirectory, StoreTaskOperation } from '../../store';
import { FileInfoTableComponent } from '../file-info-table/file-info-table.component';
import { OperationArrowComponent } from '../operation-arrow/operation-arrow.component';
import { PopoverComponent } from '../popover/popover.component';
import { ResultsTableComponent } from '../results-table/results-table.component';
import { DirProgressDirective } from './directives/dir-progress.directive';
import { ProcColIconDirective } from './directives/proc-col-icon.directive';
import { ProceedingsTableTDDirective } from './directives/proceedings-table-td.directive';
import { ProceedingsTableOperationSelectorComponent } from './proceedings-table-operation-selector/proceedings-table-operation-selector.component';
import { ServiceProvider } from '@octra/ngx-components';
import { AppSettings } from '../../shared/app.settings';

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
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProceedingsTableComponent extends SubscriberComponent implements OnInit, OnDestroy, OnChanges {
  sanitizer = inject(DomSanitizer);
  cd = inject(ChangeDetectorRef);
  taskService = inject(TaskService);
  storage = inject(StorageService);
  private ngbModalService = inject(NgbModal);
  private shortcutService = inject(ShortcutService);
  private modeStoreService = inject(ModeStoreService);

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
    operation?: StoreTaskOperation;
    task?: StoreTask;
    directory?: StoreTaskDirectory;
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

  @Input() queue: QueueItem[] = [];
  @Input() entries?: (StoreTask | StoreTaskDirectory)[] | null;
  @Input() operations?: OperationFactory[] | null = [];
  @Input() selectedRows?: Set<number> | null = new Set<number>();
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

  protected get taskList(): TaskList | undefined {
    return this.taskService.state.currentModeState.taskList;
  }

  @Output() public afterdrop = new EventEmitter<(TPortalFileInfo | TPortalDirectoryInfo)[]>();
  @Output() public operationclick: EventEmitter<StoreTaskOperation> = new EventEmitter<StoreTaskOperation>();
  @Output() public operationhover: EventEmitter<StoreTaskOperation> = new EventEmitter<StoreTaskOperation>();
  @Output() public feedbackRequested = new EventEmitter<StoreTaskOperation>();
  @ViewChild('inner', { static: true }) inner?: ElementRef;
  @ViewChild('popoverRef') public popoverRef?: PopoverComponent;
  @ViewChild('resultsTableComponent')
  public resultsTableComponent?: ResultsTableComponent;

  public selectedOperation?: OperationFactory;
  public toolSelectedOperation?: Operation;
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

  ngOnInit() {
    if (this.taskService.state.currentModeState.taskList?.entryChanged) {
      this.subscribe(this.taskService.state.currentModeState.taskList?.entryChanged, {
        next: (event) => {
          this.cd.markForCheck();
        },
      });
    }

    this.cd.detach();
    if (!(this.cd as any).destroyed) {
      this.cd.markForCheck();
      this.cd.detectChanges();
    }

    setInterval(() => {
      if (!(this.cd as any).destroyed) {
        this.cd.detectChanges();
        this.cd.markForCheck();
      }
    }, 500);
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

  public getStateIcon(operation: Operation) {
    return operation.getStateIcon(this.sanitizer, operation.state);
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
  }

  onRowSelected(entry: StoreTask | StoreTaskDirectory, operationIndex?: number, operation?: StoreTaskOperation) {
    if (!this.selectionBlocked) {
      const taskList = this.taskService.state.currentModeState.taskList;
      if (!operation || (!['OCTRA', 'Emu WebApp'].includes(operation.name) && taskList && this.taskService.currentModeState)) {
        const indexFromTaskList = (this.entries ?? []).findIndex((a: StoreTask | StoreTaskDirectory) => a.id === entry.id);
        const search = (Array.from(this.selectedRows ?? new Set<number>()) ?? []).findIndex((a) => {
          return a === indexFromTaskList;
        });
        const pressedKeys = this.shortcutService.pressedKeys;

        if (pressedKeys.has('ctrl') || pressedKeys.has('cmd')) {
          // de-/selection

          if (search > -1) {
            // deselect
            this.modeStoreService.deselectRows([search]);
          } else {
            // select
            this.modeStoreService.deselectRows([indexFromTaskList]);
          }
        } else {
          // shift selection

          if (pressedKeys.has('shift')) {
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
            const oldId = (this.selectedRows?.size ?? 0 > 0) ? Array.from(this.selectedRows ?? new Set<number>())[0] : -1;
            this.modeStoreService.setSelectedRows([]);

            if (indexFromTaskList !== oldId) {
              this.shiftStart = indexFromTaskList;
              this.modeStoreService.selectRows([indexFromTaskList]);
            }
          }
        }
      }

      const previousOperation = operationIndex && operation && operationIndex > 0 ? (entry as StoreTask).operations[operationIndex - 1] : undefined;

      if ((previousOperation && previousOperation?.lastResult?.online) || (operation && operation?.lastResult?.online)) {
        this.operationclick.emit(operation);
        console.log('row selected close');
        this.popover.state = 'closed';
      }

      this.cd.markForCheck();
      this.cd.detectChanges();
    }
  }

  onContextMenuOptionSelected(option: string) {
    if (this.taskService.currentModeState && this.taskService.currentModeState.selectedRows.length > 0) {
      if (option === 'delete') {
        this.deleteSelectedTasks();
      } else if (option === 'appendings-remove') {
        this.removeAppendings();
      } else if (option === 'download') {
        this.openArchiveDownload('line', this.selectedOperation, this.taskService.currentModeState.selectedRows);
      }
    }
    this.contextmenu.hidden = true;
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  removeAppendings() {
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
  }

  isEntrySelected(entry: Task | TaskDirectory): boolean {
    const taskList = this.taskService.state.currentModeState.taskList;

    if (taskList) {
      const tasklistIndex = taskList.getIndexByEntry(entry);
      const search = this.taskService.currentModeState!.selectedRows.findIndex((a) => {
        return a === tasklistIndex;
      });

      if (entry instanceof Task) {
        if (search > -1) {
          return true;
        } else if (!(entry.directory === null || entry.directory === undefined)) {
          return this.isEntrySelected(entry.directory);
        }
      } else {
        if (search > -1) {
          return true;
        }
      }
    }

    return false;
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

  onOperationMouseEnter($event: MouseEvent, operation: StoreTaskOperation, td: HTMLTableCellElement) {
    // show Popover for normal operations only
    if (!(operation.status === TaskStatus.PENDING || operation.status === TaskStatus.SKIPPED || operation.status === TaskStatus.READY)) {
      const icon: HTMLElement = $event.target as HTMLElement;
      const parentNode = td;

      if (parentNode && this.popoverRef && this.inner) {
        this.popover.operation = operation;
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

      this.togglePopover(true);
    }
    this.popover.task = undefined;
    // TODO check operation.onMouseEnter();
  }

  onOperationMouseLeave($event: MouseEvent, operation: Operation) {
    operation.mouseover = false;
    this.popover.mouseIn = false;
    setTimeout(() => {
      if (!this.popover.mouseIn) {
        this.togglePopover(false);
      }
    }, 250);
    operation.onMouseLeave();
  }

  /*
  onOperationMouseOver($event: MouseEvent, operation: Operation) {
    operation.mouseover = true;
    this.popover.mouseIn = true;
    this.selectedOperation = operation;
    operation.onMouseOver();
    this.operationhover.emit();
  }
*/

  onNameMouseEnter($event: MouseEvent, entry?: StoreTask | StoreTaskDirectory) {
    if (!entry) {
      return;
    }
    if (entry.type === 'task') {
      this.popover.directory = undefined;
      this.popover.task = entry;
    } else {
      this.popover.task = undefined;
      this.popover.directory = entry;
    }
    this.popover.operation = undefined;
  }

  onNameMouseLeave($event: MouseEvent, entry?: StoreTask | StoreTaskDirectory) {
    if (!entry) {
      return;
    }
    if (entry instanceof Task) {
      entry.mouseover = false;
    }
  }

  onNameMouseOver($event: MouseEvent, entry?: StoreTask | StoreTaskDirectory) {
    if (!entry) {
      return;
    }
    if (entry instanceof Task) {
      entry.mouseover = true;
    }
  }

  onInfoMouseEnter($event: MouseEvent, task?: StoreTask) {
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

      this.popover.operation = undefined;
    }
  }

  onInfoMouseLeave($event: MouseEvent, task?: StoreTask) {
    if (!task) {
      return;
    }
    this.togglePopover(false);
    // TODO check task.mouseover = false;
  }

  onInfoMouseOver($event: MouseEvent, task?: StoreTask) {
    if (!task) {
      return;
    }
    // TODO check task.mouseover = true;
  }

  calculateDuration(time: { start: number; duration?: number } | undefined, operation: StoreTaskOperation) {
    if (operation.status === TaskStatus.PROCESSING && operation?.time) {
      return (operation.time.duration ?? 0) + Math.max(0, Date.now() - operation.time.start);
    } else if (time) {
      if (time.duration && time.duration > 0) {
        return time.duration;
      }
    }
    return 0;
  }

  deactivateOperation(operation: Operation, index: number) {
    // TODO improve code!
    const taskList = this.taskService.state.currentModeState.taskList;

    if (taskList) {
      const tasks = taskList.getAllTasks().filter((a) => {
        return a.status === TaskStatus.QUEUED || a.status === TaskStatus.PENDING;
      });

      operation.enabled = !operation.enabled;
      const previous = this.taskService.state.currentModeState.operations[index - 1];
      const next = this.taskService.state.currentModeState.operations[index + 1];
      if (operation instanceof ASROperation) {
        if (!next.enabled && !operation.enabled) {
          next.enabled = true;

          for (const task of tasks) {
            const taskOperation = task.operations[index + 1];
            const currOperation = task.operations[index];

            if (taskOperation.state === TaskStatus.PENDING) {
              taskOperation.enabled = next.enabled;
            }
            if (currOperation.state === TaskStatus.PENDING) {
              currOperation.enabled = operation.enabled;
            }
          }
        }
      } else if (operation instanceof G2pMausOperation) {
        next.enabled = !next.enabled;

        for (const task of tasks) {
          const taskOperation = task.operations[index + 1];
          const currOperation = task.operations[index];

          if (taskOperation.state === TaskStatus.PENDING) {
            taskOperation.enabled = next.enabled;
          }
          if (currOperation.state === TaskStatus.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      } else if (operation instanceof SummarizationOperation || operation instanceof TranslationOperation) {
        for (const task of tasks) {
          const currOperation = task.operations[index];

          if (currOperation.state === TaskStatus.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      } else if (!previous.enabled && !operation.enabled) {
        previous.enabled = true;

        for (const task of tasks) {
          const taskOperation = task.operations[index - 1];
          const currOperation = task.operations[index];
          let hasTranscript = false;
          if (currOperation?.task) {
            // check if transcript was added to the task
            hasTranscript =
              currOperation.task.files.findIndex((a) => {
                return this.taskService.validTranscript(a.extension);
              }) > -1;
          }

          if (!hasTranscript) {
            if (taskOperation.state === TaskStatus.PENDING) {
              taskOperation.enabled = previous.enabled;
            }

            if (currOperation.state === TaskStatus.PENDING) {
              currOperation.enabled = operation.enabled;
            }
          }
        }
      }

      this.updateEnableState();
    }
  }

  public updateEnableState() {
    const taskList = this.taskService.state.currentModeState.taskList;
    if (taskList) {
      const tasks = taskList.getAllTasks().filter((a) => {
        return a.status === TaskStatus.QUEUED || a.status === TaskStatus.PENDING;
      });

      for (let j = 0; j < this.taskService.state.currentModeState.operations.length; j++) {
        const operation = this.taskService.state.currentModeState.operations[j];

        for (const task of tasks) {
          const currOperation = task.operations[j];
          if (currOperation?.task) {
            // check if transcript was added to the task
            const hasTranscript =
              currOperation.task.files.findIndex((a) => {
                return this.taskService.validTranscript(a.extension);
              }) > -1;

            if (!hasTranscript) {
              if (currOperation.state === TaskStatus.PENDING) {
                currOperation.enabled = operation.enabled;
              }
            }
          }
        }
      }
    }
  }

  public getPopoverColor(operation: StoreTaskOperation): string {
    if (operation) {
      if (operation.status === TaskStatus.ERROR || (operation.status === TaskStatus.FINISHED && !operation?.lastResult?.available)) {
        return 'red';
      } else if (operation.status === TaskStatus.FINISHED && operation.protocol) {
        return '#ffc33b';
      }
    }
    return '#3a70dd';
  }

  /*
  public onOperationClick($event: MouseEvent, operation: Operation) {
    if (operation instanceof OCTRAOperation || operation instanceof EmuOperation) {
      this.popover.state = 'closed';
      console.log('operation click selected close');
      this.cd.markForCheck();
      this.cd.detectChanges();
      this.selectedOperation = undefined;
    } else {
      this.selectedOperation = operation;
    }
    this.operationclick.emit(operation);
  }

 */

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

  onShortcutRowRemove = (keyboardEvent: KeyboardEvent, shortcut: Shortcut, hotkeyEvent: HotkeysEvent, shortcutGroup: ShortcutGroup) => {
    this.popover.state = 'closed';
    this.deleteSelectedTasks();
    this.cd.markForCheck();
  };

  onShortcutRowsSelectAll = (keyboardEvent: KeyboardEvent, shortcut: Shortcut, hotkeyEvent: HotkeysEvent, shortcutGroup: ShortcutGroup) => {
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
    this.cd.markForCheck();
    this.cd.detectChanges();
  };

  public removeEntry(event: MouseEvent, entry?: StoreTask | StoreTask) {
    if (entry) {
      this.modeStoreService.removeTaskOrFolder(entry);
    }
  }

  public getBadge(task: Task): {
    type: string;
    label: string;
  } {
    if ((task.files.length > 1 && task.files[1].file !== undefined) || task.operations[0].rounds.length > 1 || task.files[0].extension !== '.wav') {
      return {
        type: 'info',
        label: task.files[0].extension !== '.wav' ? task.files[0].extension : task.files[1].extension,
      };
    } else {
      return {
        type: 'warning',
        label: task.files[0].extension !== '.wav' ? task.files[0].extension : task.files[1].extension,
      };
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

  onTagClicked() {
    this.selectionBlocked = true;

    setTimeout(() => {
      this.selectionBlocked = false;
    }, 1000);
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
  }

  onExportButtonClick(task: StoreTask | StoreTaskDirectory, rowIndex: number, operation?: OperationFactory) {
    const selectedRows = [rowIndex];
    // this.selectedOperation = operation;
    this.openArchiveDownload('line', operation, selectedRows);
  }

  isOneOperationFinished(entry: StoreTask | StoreTaskDirectory): boolean {
    if (entry) {
      const checkTask = (task: StoreTask) => {
        for (const operation of task.operations) {
          if (operation.name !== 'Upload') {
            if (operation.status === TaskStatus.FINISHED || operation.rounds.length > 0) {
              return true;
            }
          }
        }
        return false;
      };

      if (entry.type === 'task') {
        return checkTask(entry as StoreTask);
      } else {
        for (const index of (entry as StoreTaskDirectory).entries.ids) {
          if (checkTask(entry.entries.entities[index] as StoreTask)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  public getDirEntriesFromItem(entry: QueueItem): TPortalFileInfo[] {
    if (entry.file instanceof TPortalDirectoryInfo) {
      return entry.file.entries as TPortalFileInfo[];
    }
    return [];
  }

  public getTaskDirEntries(entry: StoreTask | StoreTaskDirectory): StoreTask[] {
    if (entry.type === 'folder') {
      return Object.keys((entry as StoreTaskDirectory).entries.entities).map((a) => (entry as StoreTaskDirectory).entries.entities[a]) as StoreTask[];
    }
    return [];
  }

  public getFileInfo(entry: QueueItem) {
    return entry.file instanceof TPortalFileInfo ? (entry.file as TPortalFileInfo) : undefined;
  }

  public getTaskDirectory(entry: StoreTask | StoreTaskDirectory): StoreTaskDirectory | undefined {
    if (entry.type === 'folder') {
      return entry as StoreTaskDirectory;
    }
    return undefined;
  }

  public getTask(entry: StoreTask | StoreTaskDirectory): StoreTask | undefined {
    if (entry.type === "task") {
      return entry as StoreTask;
    }
    return undefined;
  }

  getAudioFileOfTask(task: StoreTask): TPortalAudioInfo | undefined {
    if (task.files.length > 0 && task.files[0] instanceof TPortalAudioInfo) {
      return task.files[0];
    }
    return undefined;
  }

  getServerProvider(basName?: string): ServiceProvider | undefined{
    return AppSettings.getServiceInformation(basName);
  }
}
