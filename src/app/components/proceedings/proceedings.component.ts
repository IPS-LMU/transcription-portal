import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
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
import {HttpClient} from '@angular/common/http';
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
    pointer: string
  } = {
    x: 0,
    y: 0,
    state: 'closed',
    width: 200,
    height: 320,
    operation: null,
    task: null,
    pointer: 'left'
  };

  @Input() taskList: TaskList = new TaskList();
  @Input() queue: QueueItem[] = [];
  @Input() operations: Operation[] = [];
  private fileAPIsupported = false;
  public selectedRows: number[] = [];
  public archiveURL = '';
  public closeResult = '';
  public isDragging = false;
  private shiftStart = -1;
  private allSelected = false;

  private selectionBlocked = false;

  private shortcutManager = new ShortcutManager();

  public allDirOpened: 'opened' | 'closed' = 'closed';

  @Input() shortstyle = false;

  @Output() public afterdrop: EventEmitter<(FileInfo | DirectoryInfo)[]> = new EventEmitter<(FileInfo | DirectoryInfo)[]>();
  @Output() public operationclick: EventEmitter<Operation> = new EventEmitter<Operation>();
  @Output() public operationhover: EventEmitter<Operation> = new EventEmitter<Operation>();
  @ViewChild('content') content: DownloadModalComponent;

  @ViewChild('popoverRef') public popoverRef: PopoverComponent;
  @ViewChild('filePreview') public filePreview: FilePreviewModalComponent;

  public selectedOperation: Operation;
  public toolSelectedOperation: Operation;

  constructor(public sanitizer: DomSanitizer, private cd: ChangeDetectorRef, public taskService: TaskService, private http: HttpClient,
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
    if (!this.cd['destroyed']) {
      this.cd.detectChanges();
    }

    setInterval(() => {
      if (!this.cd['destroyed']) {
        this.cd.detectChanges();
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

      for (let i = 0; i < droppedfiles.length; i++) {
        let item: WebKitEntry = droppedfiles[i].webkitGetAsEntry();

        if (item.isDirectory) {
          // TODO fix order!
          promises.push(new Promise<void>((resolve, reject) => {
            DirectoryInfo.fromFolderObject(droppedfiles[i]).then((dir) => {
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
          let file = droppedfiles[i].getAsFile();
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
    }
    else {
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

  onRowSelected(entry: (Task | TaskDirectory), operation: Operation) {
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
            const old_id = (this.selectedRows.length > 0) ? this.selectedRows[0] : -1;

            this.selectedRows = [];

            if (indexFromTaskList !== old_id) {
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
    }
  }


  onContextMenuOptionSelected(option: String) {
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
    for (let i = 0; i < this.selectedRows.length; i++) {
      const index = this.selectedRows[i];
      const entry = this.taskList.getEntryByIndex(index);
      if (entry instanceof Task) {
        if (entry.files.length > 1) {
          entry.files.splice(1)
          entry.operations[1].enabled = this.taskService.operations[1].enabled;
          entry.operations[1].changeState(entry.state);
        }
      } else {
        for (let j = 0; j < entry.entries.length; j++) {
          const task = <Task> entry.entries[j];
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
      return a === tasklistIndex
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
  }

  onOperationMouseEnter($event, operation: Operation) {
    // show Popover for normal operations only
    if (!(operation instanceof EmuOperation) && !(operation.state === TaskState.PENDING || operation.state === TaskState.SKIPPED || operation.state === TaskState.READY)) {
      this.popover.operation = operation;
      if (operation.protocol !== '') {
        this.popover.width = 500;
      } else {
        this.popover.width = 400;
      }
      this.popover.height = 230;
      if (($event.target.offsetLeft + this.popover.width) < window.innerWidth) {
        this.popover.x = $event.target.offsetLeft + ($event.target.offsetWidth / 2);
        this.popover.pointer = ($event.layerY + this.popoverRef.height > window.innerHeight) ? 'bottom-left' : 'left';
      } else {
        this.popover.x = $event.target.offsetLeft - this.popover.width + ($event.target.offsetWidth / 2);
        this.popover.pointer = ($event.layerY + this.popoverRef.height < window.innerHeight) ? 'right' : 'bottom-right';
      }

      this.popover.y = ($event.layerY + this.popoverRef.height > window.innerHeight) ? $event.layerY - this.popoverRef.height : $event.layerY;
      this.togglePopover(true);

    }
    this.popover.task = null;
    operation.onMouseEnter();
  }

  onOperationMouseLeave($event, operation: Operation) {
    if (!(operation instanceof EmuOperation) && !(operation.state === TaskState.PENDING)) {
      this.togglePopover(false);
    }
    operation.mouseover = false;
    operation.onMouseLeave();
  }

  onOperationMouseOver($event, operation: Operation) {
    operation.mouseover = true;
    this.selectedOperation = operation;
    operation.onMouseOver();
    this.operationhover.emit();
  }

  onNameMouseEnter($event, entry: (Task | TaskDirectory), td: HTMLTableDataCellElement) {
    if (entry instanceof Task) {
      this.popover.task = entry;
      this.popover.operation = null;
    }
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

  onInfoMouseEnter($event, task: Task, td: HTMLTableDataCellElement) {
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

  calculateDuration(time) {
    if (time.duration > 0) {
      return time.duration;
    } else {
      return Date.now() - time.start;
    }
  }

  getMailToLink(task: Task) {
    if (task.state === TaskState.FINISHED) {
      const tool_url = (<EmuOperation> task.operations[4]).getToolURL();
      let subject = 'OH-Portal Links';
      let body = '' +
        'Pipeline ASR->G2P->CHUNKER:\n' + task.operations[1].results[0].url + '\n\n' +
        'MAUS:\n' + task.operations[3].results[0].url + '\n\n' +
        'EMU WebApp:\n' + tool_url;
      subject = encodeURI(subject);
      body = encodeURIComponent(body);

      return `mailto:?subject=${subject}&body=${body}`;
    }
    return '';
  }

  deactivateOperation(operation: Operation, index: number) {
    // TODO improve code!
    let tasks = this.taskList.getAllTasks().filter((a) => {
      return a.state === TaskState.QUEUED || a.state === TaskState.PENDING;
    });

    operation.enabled = !operation.enabled;
    const previous = this.taskService.operations[index - 1];
    const next = this.taskService.operations[index + 1];
    if (operation instanceof OCTRAOperation) {
      if (!previous.enabled && !operation.enabled) {
        previous.enabled = true;

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const task_operation = task.operations[index - 1];
          const currOperation = task.operations[index];

          if (task_operation.state === TaskState.PENDING) {
            task_operation.enabled = previous.enabled;
          }

          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    } else if (operation instanceof ASROperation) {
      if (!next.enabled && !operation.enabled) {
        next.enabled = true;

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const task_operation = task.operations[index + 1];
          const currOperation = task.operations[index];

          if (task_operation.state === TaskState.PENDING) {
            task_operation.enabled = next.enabled;
          }
          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    } else if (operation instanceof G2pMausOperation) {
      next.enabled = !next.enabled;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const task_operation = task.operations[index + 1];
        const currOperation = task.operations[index];

        if (task_operation.state === TaskState.PENDING) {
          task_operation.enabled = next.enabled;
        }
        if (currOperation.state === TaskState.PENDING) {
          currOperation.enabled = operation.enabled;
        }
      }
    }

    this.updateEnableState();
  }

  public updateEnableState() {
    let tasks = this.taskList.getAllTasks().filter((a) => {
      return a.state === TaskState.QUEUED || a.state === TaskState.PENDING;
    });

    for (let j = 0; j < this.taskService.operations.length; j++) {
      const operation = this.taskService.operations[j];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const currOperation = task.operations[j];

        if (currOperation.state === TaskState.PENDING) {
          currOperation.enabled = operation.enabled;
        }
      }
    }
  }

  public getPopoverColor(operation): string {
    if (!(operation === null || operation === undefined)) {
      if (operation.state == TaskState.ERROR || (operation.results.length > 0 && !operation.lastResult.available)) {
        return 'red';
      } else if (operation.state === TaskState.FINISHED && operation.protocol !== '') {
        return '#ffc33b';
      }
    }
    return '#3a70dd'
  }

  public onOperationClick($event, operation: Operation) {
    if (operation instanceof UploadOperation || operation instanceof EmuOperation) {
      setTimeout(() => {
        this.popover.state = 'closed';
      }, 1000);
      this.selectedOperation = undefined;
    } else {
      this.selectedOperation = operation;
    }
    this.operationclick.emit(operation);
  }

  openArchiveDownload(type: 'column' | 'line', operation: Operation) {
    this.selectedOperation = operation;
    this.content.open(type);
  }

  @HostListener('window:keydown', ['$event'])
  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    this.shortcutManager.checkKeyEvent(event).then((result) => {
      if (result.command === 'remove') {
        this.popover.state = 'closed';
        this.deleteSelectedTasks();
      } else if (result.command == 'select all') {
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
    }).catch((error) => {
      console.error(error);
    });
  }

  private deleteSelectedTasks() {
    const removeQueue = [];

    for (let i = 0; i < this.selectedRows.length; i++) {
      const index = this.selectedRows[i];
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

    for (let i = 0; i < removeQueue.length; i++) {
      const entry = removeQueue[i];
      this.taskService.taskList.removeEntry(entry, true).catch((error) => {
        console.error(error);
      });
    }

    this.selectedRows = [];
    this.shiftStart = -1;
  }

  public removeEntry(event, entry: Task | TaskDirectory) {
    this.taskService.taskList.removeEntry(entry, true).catch((error) => {
      console.error(error);
    });
    setTimeout(() => {
      this.selectedRows = [];
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
      }
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

  toggleOperationDescription(tooltip) {
    if (tooltip.isOpen()) {
      tooltip.close();
      this.cd.markForCheck();
      this.cd.detectChanges();
    } else {
      tooltip.open();
      this.cd.markForCheck();
      this.cd.detectChanges();
    }
  }
}
