import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {ANIMATIONS} from '../../shared/Animations';

import {PopoverComponent} from '../popover/popover.component';
import {Task, TaskDirectory, TaskList, TaskState} from '../../obj/tasks';
import {UploadOperation} from '../../obj/operations/upload-operation';
import {FileInfo} from '../../obj/fileInfo';
import {TaskService} from '../../obj/tasks/task.service';
import {DirectoryInfo} from '../../obj/directoryInfo';
import {OCTRAOperation} from '../../obj/operations/octra-operation';
import {StorageService} from '../../storage.service';
import {Operation} from '../../obj/operations/operation';
import {ToolOperation} from '../../obj/operations/tool-operation';
import {EmuOperation} from '../../obj/operations/emu-operation';
import {ASROperation} from '../../obj/operations/asr-operation';
import {QueueItem} from '../../obj/preprocessor';
import {FilePreviewModalComponent} from '../../modals/file-preview-modal/file-preview-modal.component';
import {DownloadModalComponent} from '../../modals/download-modal/download-modal.component';
import {G2pMausOperation} from '../../obj/operations/g2p-maus-operation';
import {ShortcutManager} from '../../obj/shortcut-manager';
import * as clipboard from 'clipboard-polyfill';
import {isNullOrUndefined} from '../../shared/Functions';

declare var window: any;

@Component({
  selector: 'app-proceedings',
  templateUrl: './proceedings.component.html',
  styleUrls: ['./proceedings.component.css'],
  animations: ANIMATIONS,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProceedingsComponent implements OnInit, OnDestroy, OnChanges {

  public contextmenu = {
    x: 0,
    y: 0,
    hidden: true
  };

  public popover: {
    x: number,
    y: number,
    state: string,
    width: number,
    height: number,
    operation: Operation,
    task: Task,
    directory: TaskDirectory,
    pointer: 'left' | 'right' | 'bottom-left' | 'bottom-right',
    mouseIn: boolean
  } = {
    x: 0,
    y: 0,
    state: 'closed',
    width: 200,
    height: 320,
    operation: null,
    task: null,
    directory: null,
    pointer: 'left',
    mouseIn: false
  };

  @Input() taskList: TaskList = new TaskList();
  @Input() queue: QueueItem[] = [];
  @Input() operations: Operation[] = [];
  public selectedRows: number[] = [];
  public archiveURL = '';
  public closeResult = '';
  public isDragging = false;
  public allDirOpened: 'opened' | 'closed' = 'closed';
  @Input() shortstyle = false;
  @Input() isClosed = false;

  @Output()
  public get shortcutsEnabled(): boolean {
    return this.shortcutManager.shortcutsEnabled;
  }

  @Input()
  public set shorcutsEnabled(value: boolean) {
    this.shortcutManager.shortcutsEnabled = value;
  }

  @Output() public afterdrop: EventEmitter<(FileInfo | DirectoryInfo)[]> = new EventEmitter<(FileInfo | DirectoryInfo)[]>();
  @Output() public operationclick: EventEmitter<Operation> = new EventEmitter<Operation>();
  @Output() public operationhover: EventEmitter<Operation> = new EventEmitter<Operation>();
  @Output() public feedbackRequested = new EventEmitter<Operation>();
  @ViewChild('content', {static: true}) content: DownloadModalComponent;
  @ViewChild('inner', {static: true}) inner: ElementRef;
  @ViewChild('popoverRef') public popoverRef: PopoverComponent;
  @ViewChild('filePreview', {static: true}) public filePreview: FilePreviewModalComponent;


  public selectedOperation: Operation;
  public toolSelectedOperation: Operation;
  private readonly fileAPIsupported: boolean = false;
  private shiftStart = -1;
  private allSelected = false;
  private selectionBlocked = false;
  private shortcutManager = new ShortcutManager();

  constructor(public sanitizer: DomSanitizer, public cd: ChangeDetectorRef, public taskService: TaskService,
              public storage: StorageService) {
    // Check for the various FileInfo API support.
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      this.fileAPIsupported = true;
    }
  }

  public get d() {
    return Date.now();
  }

  ngOnInit() {
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

  ngOnChanges(changes: SimpleChanges) {
  }

  ngOnDestroy() {
    this.cd.detach();
  }

  onDragOver($event) {
    $event.stopPropagation();
    $event.preventDefault();
    $event.dataTransfer.dropEffect = 'copy';
    this.isDragging = true;

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public getStateIcon(operation: Operation) {
    return operation.getStateIcon(this.sanitizer, operation.state);
  }

  onDrop($event) {
    $event.stopPropagation();
    $event.preventDefault();
    this.isDragging = false;

    const promises: Promise<void>[] = [];

    if (this.fileAPIsupported) {

      // TODO check browser support
      const droppedfiles = $event.dataTransfer.items;
      const files: (FileInfo | DirectoryInfo)[] = [];

      for (const droppedItem of droppedfiles) {
        const item: any = droppedItem.webkitGetAsEntry();

        if (item.isDirectory) {
          // TODO fix order!
          promises.push(new Promise<void>((resolve, reject) => {
            DirectoryInfo.fromFolderObject(droppedItem).then((dir) => {
              // check added directory
              files.push(dir);
              resolve();
            }).catch((error) => {
              this.afterdrop.error(error);
              reject();
            });
          }));
        } else {
          // check added file
          const file = droppedItem.getAsFile();
          if (!(file === null || file === undefined)) {
            // check file
            if (file.name.indexOf('.') > -1) {
              files.push(FileInfo.fromFileObject(file));
              this.cd.markForCheck();
              this.cd.detectChanges();
            }
          } else {
            this.afterdrop.error(`could not read file from webKitFile`);
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
    } else {
      this.afterdrop.error(`file api not supported`);
    }
  }

  onContextMenu(event) {
    event.preventDefault();

    if (this.selectedRows.length <= 1) {
      this.selectedRows = [];
      const index = this.taskList.getIndexByEntry(this.popover.task);
      this.selectedRows.push(index);
    }
    this.contextmenu.x = event.layerX - 20;
    this.contextmenu.y = event.layerY;
    this.contextmenu.hidden = false;
  }

  onContextBlur() {
    this.contextmenu.hidden = true;
  }

  onRowSelected(entry: (Task | TaskDirectory), operation?: Operation) {
    if (!this.selectionBlocked) {
      if (((operation === null || operation === undefined) || !(operation instanceof ToolOperation))) {

        const indexFromTaskList = this.taskList.getIndexByEntry(entry);
        const search = this.selectedRows.findIndex((a) => {
          return a === indexFromTaskList;
        });

        if (this.shortcutManager.pressedKey.name === 'CMD' || this.shortcutManager.pressedKey.name === 'CTRL') {
          // de-/selection

          if (search > -1) {
            // deselect
            this.selectedRows.splice(search, 1);
          } else {
            // select
            this.selectedRows.push(indexFromTaskList);
          }

          /* What is this?
          const puffer = [];
          for (let i = 0; i < this.selectedRows.length; i++) {
            const task = this.selectedRows[i];
            if (puffer.find((a) => {
              return task.id === a.id;
            }) === undefined) {
              puffer.push(task);
            }
          }
          this.selectedRows = puffer;
          */
        } else {
          // shift selection

          if (this.shortcutManager.pressedKey.name === 'SHIFT') {
            // shift pressed
            if (this.shiftStart > -1) {
              let end = indexFromTaskList;

              if (this.shiftStart > end) {
                const temp = this.shiftStart;
                this.shiftStart = end;
                end = temp;
              }

              this.selectedRows = [];
              const entries = this.taskList.entries;
              for (let i = this.shiftStart; i <= end; i++) {
                this.selectedRows.push(i);
              }
              // select all between
              // const start =x
              this.shiftStart = -1;
            }
          } else {
            const oldId = (this.selectedRows.length > 0) ? this.selectedRows[0] : -1;

            this.selectedRows = [];

            if (indexFromTaskList !== oldId) {
              this.shiftStart = indexFromTaskList;
              this.selectedRows.push(indexFromTaskList);
            }
          }
        }
      }

      if (
        (!(operation === null || operation === undefined)
          && !(operation.previousOperation === null || operation.previousOperation === undefined)
          && operation.previousOperation.results.length > 0 &&
          operation.previousOperation.results[operation.previousOperation.results.length - 1].online
        )
        || (!(operation === null || operation === undefined) && operation.results.length > 0
        && operation.results[operation.results.length - 1].online)
      ) {
        this.operationclick.emit(operation);
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
      this.removeAppendings();
    } else if (option === 'download') {
      this.openArchiveDownload('line', this.selectedOperation);
    }
    this.contextmenu.hidden = true;
  }

  removeAppendings() {
    for (const index of this.selectedRows) {
      const entry = this.taskList.getEntryByIndex(index);
      if (entry instanceof Task) {
        if (entry.files.length > 1) {
          entry.files.splice(1);
          entry.operations[1].enabled = this.taskService.operations[1].enabled;
          entry.operations[1].changeState(entry.state);
        }
      } else {
        for (const entryElem of entry.entries) {
          const task = entryElem as Task;
          if (task.files.length > 1) {
            task.files.splice(1);
            task.operations[1].enabled = this.taskService.operations[1].enabled;
            task.operations[1].changeState(task.state);
          }
        }
      }
    }
  }

  isEntrySelected(entry: (Task | TaskDirectory)) {

    const tasklistIndex = this.taskList.getIndexByEntry(entry);
    const search = this.selectedRows.findIndex((a) => {
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

    return false;
  }

  togglePopover(show: boolean) {
    if (show) {
      this.popover.state = 'opened';
    } else {
      this.popover.state = 'closed';
    }

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onOperationMouseEnter($event, operation: Operation) {
    // show Popover for normal operations only
    if (!(operation.state === TaskState.PENDING || operation.state === TaskState.SKIPPED || operation.state === TaskState.READY)) {
      const icon = $event.target;
      const parentNode = icon.parentNode;

      this.popover.operation = operation;
      if (operation.protocol !== '') {
        this.popover.width = 500;
      } else {
        this.popover.width = 400;
      }
      this.popover.height = 230;
      if ((parentNode.offsetLeft + this.popover.width) < window.innerWidth) {
        this.popover.x = parentNode.offsetLeft + (parentNode.offsetWidth / 2);
        this.popover.pointer = ($event.layerY + this.popoverRef.height + 20 > window.innerHeight) ? 'bottom-left' : 'left';
      } else {
        this.popover.x = parentNode.offsetLeft - this.popover.width + (parentNode.offsetWidth / 2);
        this.popover.pointer = ($event.layerY + this.popoverRef.height + 20 < window.innerHeight) ? 'right' : 'bottom-right';
      }
      this.updateChanges();

      const top = icon.offsetTop + parentNode.offsetTop - this.inner.nativeElement.scrollTop + icon.offsetHeight;
      this.popover.y = (top + this.popoverRef.height + 20 > window.innerHeight)
        ? top - this.popover.height : top;


      this.togglePopover(true);

    }
    this.popover.task = null;
    operation.onMouseEnter();
  }

  onOperationMouseLeave($event, operation: Operation) {
    operation.mouseover = false;
    this.popover.mouseIn = false;
    setTimeout(() => {
      if (!this.popover.mouseIn) {
        this.togglePopover(false);
      }
    }, 250);
    operation.onMouseLeave();
  }

  onOperationMouseOver($event, operation: Operation) {
    operation.mouseover = true;
    this.popover.mouseIn = true;
    this.selectedOperation = operation;
    operation.onMouseOver();
    this.operationhover.emit();
  }

  onNameMouseEnter($event, entry: (Task | TaskDirectory)) {
    if (entry instanceof Task) {
      this.popover.directory = null;
      this.popover.task = entry;
    } else {
      this.popover.task = null;
      this.popover.directory = entry;
    }
    this.popover.operation = null;
  }

  onNameMouseLeave($event, entry: (Task | TaskDirectory)) {
    if (entry instanceof Task) {
      entry.mouseover = false;
    }
  }

  onNameMouseOver($event, entry: (Task | TaskDirectory)) {
    if (entry instanceof Task) {
      entry.mouseover = true;
    }
  }

  onInfoMouseEnter($event, task: Task) {
    // show Popover for normal operations only
    const y = $event.layerY + 10;
    this.popover.task = task;
    this.popover.x = $event.layerX + 10;
    this.popover.width = 600;
    this.popover.height = 320;
    this.popover.pointer = (y + this.popoverRef.height > window.innerHeight) ? 'bottom-left' : 'left';
    this.popover.y = (y + this.popoverRef.height > window.innerHeight) ? y - this.popoverRef.height : y;
    this.togglePopover(true);

    this.popover.operation = null;
  }

  onInfoMouseLeave($event, task: Task) {
    this.togglePopover(false);
    task.mouseover = false;
  }

  onInfoMouseOver($event, task: Task) {
    task.mouseover = true;
  }

  calculateDuration(time, operation: Operation) {
    if (operation.state === TaskState.PROCESSING) {
      return operation.time.duration + Math.max(0, Date.now() - operation.time.start);
    } else {
      if (time.duration > 0) {
        return time.duration;
      } else {
        return Date.now() - time.start;
      }
    }
  }

  getMailToLink(task: Task) {
    if (task.state === TaskState.FINISHED) {
      const toolURL = (task.operations[4] as EmuOperation).getToolURL();
      let subject = 'OH-Portal Links';
      let body = '' +
        'Pipeline ASR->G2P->CHUNKER:\n' + task.operations[1].results[0].url + '\n\n' +
        'MAUS:\n' + task.operations[3].results[0].url + '\n\n' +
        'EMU WebApp:\n' + toolURL;
      subject = encodeURI(subject);
      body = encodeURIComponent(body);

      return `mailto:?subject=${subject}&body=${body}`;
    }
    return '';
  }

  deactivateOperation(operation: Operation, index: number) {
    // TODO improve code!
    const tasks = this.taskList.getAllTasks().filter((a) => {
      return a.state === TaskState.QUEUED || a.state === TaskState.PENDING;
    });

    operation.enabled = !operation.enabled;
    const previous = this.taskService.operations[index - 1];
    const next = this.taskService.operations[index + 1];
    if (operation instanceof OCTRAOperation) {

      if (!previous.enabled && !operation.enabled) {
        previous.enabled = true;

        for (const task of tasks) {
          const taskOperation = task.operations[index - 1];
          const currOperation = task.operations[index];
          // check if transcript was added to the task
          const hasTranscript = currOperation.task.files.findIndex((a) => {
            return this.taskService.validTranscript(a.extension);
          }) > -1;

          if (!hasTranscript) {
            if (taskOperation.state === TaskState.PENDING) {
              taskOperation.enabled = previous.enabled;
            }

            if (currOperation.state === TaskState.PENDING) {
              currOperation.enabled = operation.enabled;
            }
          }
        }
      }
    } else if (operation instanceof ASROperation) {
      if (!next.enabled && !operation.enabled) {
        next.enabled = true;

        for (const task of tasks) {
          const taskOperation = task.operations[index + 1];
          const currOperation = task.operations[index];

          if (taskOperation.state === TaskState.PENDING) {
            taskOperation.enabled = next.enabled;
          }
          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    } else if (operation instanceof G2pMausOperation) {
      next.enabled = !next.enabled;

      for (const task of tasks) {
        const taskOperation = task.operations[index + 1];
        const currOperation = task.operations[index];

        if (taskOperation.state === TaskState.PENDING) {
          taskOperation.enabled = next.enabled;
        }
        if (currOperation.state === TaskState.PENDING) {
          currOperation.enabled = operation.enabled;
        }
      }
    }

    this.updateEnableState();
  }

  public updateEnableState() {
    const tasks = this.taskList.getAllTasks().filter((a) => {
      return a.state === TaskState.QUEUED || a.state === TaskState.PENDING;
    });

    for (let j = 0; j < this.taskService.operations.length; j++) {
      const operation = this.taskService.operations[j];

      for (const task of tasks) {
        const currOperation = task.operations[j];

        // check if transcript was added to the task
        const hasTranscript = currOperation.task.files.findIndex((a) => {
          return this.taskService.validTranscript(a.extension);
        }) > -1;

        if (!hasTranscript) {
          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    }
  }

  public getPopoverColor(operation): string {
    if (!(operation === null || operation === undefined)) {
      if (operation.state === TaskState.ERROR || (operation.results.length > 0 && !operation.lastResult.available)) {
        return 'red';
      } else if (operation.state === TaskState.FINISHED && operation.protocol !== '') {
        return '#ffc33b';
      }
    }
    return '#3a70dd';
  }

  public onOperationClick($event, operation: Operation) {
    if (operation instanceof UploadOperation || operation instanceof EmuOperation) {
      this.popover.state = 'closed';
      this.cd.markForCheck();
      this.cd.detectChanges();
      this.selectedOperation = undefined;
    } else {
      this.selectedOperation = operation;
    }
    this.operationclick.emit(operation);
  }

  openArchiveDownload(type: 'column' | 'line', operation: Operation) {
    if (operation !== null && operation !== undefined && operation.name !== 'Upload') {
      this.selectedOperation = operation;
      this.content.open(type);
    } else if (type === 'line') {
      this.content.open(type);
    }
  }

  @HostListener('window:keydown', ['$event'])
  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.shortcutManager.checkKeyEvent(event).then((result) => {
      if (!isNullOrUndefined(result)) {
        if (result.command === 'remove') {
          this.popover.state = 'closed';
          this.deleteSelectedTasks();
        } else if (result.command === 'select all') {
          this.selectedRows = [];
          if (!this.allSelected) {
            // select all
            const length = this.taskList.length;

            for (let i = 0; i < length; i++) {
              this.selectedRows.push(i);
            }
            this.allSelected = true;
          } else {
            this.allSelected = false;
          }
        }
        this.cd.markForCheck();
        this.cd.detectChanges();
      }
    }).catch((error) => {
      console.error(error);
    });
  }

  public removeEntry(event, entry: Task | TaskDirectory) {
    this.taskService.taskList.removeEntry(entry, true).catch((error) => {
      console.error(error);
    });
    setTimeout(() => {
      this.selectedRows = [];
      this.cd.markForCheck();
      this.cd.detectChanges();
    }, 0);
  }

  public getBadge(task: Task): {
    type: string,
    label: string
  } {
    if ((task.files.length > 1 && task.files[1].file !== undefined || task.operations[0].results.length > 1)
      || (task.files[0].extension !== '.wav')
    ) {
      return {
        type: 'info',
        label: (task.files[0].extension !== '.wav') ? task.files[0].extension : task.files[1].extension
      };
    } else {
      return {
        type: 'warning',
        label: (task.files[0].extension !== '.wav') ? task.files[0].extension : task.files[1].extension
      };
    }
  }

  public onPreviewClick(file: FileInfo) {
    this.filePreview.open(file);
  }

  onTagClicked(state) {
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

  toolTipAction(action: string, tooltip) {
    if (action === 'open') {
      tooltip.open();
    } else {
      tooltip.close();
    }

    this.updateChanges();
  }

  copyProtocolToClipboard(protocol: string) {
    clipboard.writeText(protocol);
  }

  onReportIconClick(operation: Operation) {
    this.feedbackRequested.emit(operation);
  }

  public updateChanges() {
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  private deleteSelectedTasks() {
    const removeQueue = [];

    for (const index of this.selectedRows) {
      const entry = this.taskList.getEntryByIndex(index);

      let dirFound = false;
      if (entry instanceof Task && !(entry.directory === null || entry.directory === undefined)) {
        const dirIndex = this.taskList.getIndexByEntry(entry.directory);

        // found folder?
        dirFound = this.selectedRows.findIndex((a) => {
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

    for (const entry of removeQueue) {
      this.taskService.taskList.removeEntry(entry, true).catch((error) => {
        console.error(error);
      });
    }

    this.selectedRows = [];
    this.shiftStart = -1;
    this.cd.markForCheck();
    this.cd.detectChanges();
  }
}
