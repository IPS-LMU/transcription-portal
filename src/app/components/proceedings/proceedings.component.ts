import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  HostListener,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild
} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {ANIMATIONS} from '../../shared/Animations';

import {PopoverComponent} from '../popover/popover.component';
import {Task, TaskDirectory, TaskList, TaskState} from '../../obj/tasks';
import {UploadOperation} from '../../obj/tasks/upload-operation';
import {HttpClient} from '@angular/common/http';
import {FileInfo} from '../../obj/fileInfo';
import {TaskService} from '../../obj/tasks/task.service';
import {DirectoryInfo} from '../../obj/directoryInfo';
import {OCTRAOperation} from '../../obj/tasks/octra-operation';
import {StorageService} from '../../storage.service';
import {Operation} from '../../obj/tasks/operation';
import {ToolOperation} from '../../obj/tasks/tool-operation';
import {EmuOperation} from '../../obj/tasks/emu-operation';
import {ASROperation} from '../../obj/tasks/asr-operation';
import {QueueItem} from '../../obj/preprocessor';
import {FilePreviewModalComponent} from '../../modals/file-preview-modal/file-preview-modal.component';
import {DownloadModalComponent} from '../../modals/download-modal/download-modal.component';
import {G2pMausOperation} from '../../obj/tasks/g2p-maus-operation';
import {ShortcutManager} from '../../obj/shortcut-manager';

declare var window: any;

@Component({
  selector: 'app-proceedings',
  templateUrl: './proceedings.component.html',
  styleUrls: ['./proceedings.component.css'],
  animations: ANIMATIONS,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProceedingsComponent implements OnInit, OnDestroy {

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
  public selected_tasks: (Task | TaskDirectory)[] = [];
  public archiveURL = '';
  public closeResult = '';
  public isDragging = false;
  private shiftStart = -1;
  private allSelected = false;

  private shortcutManager = new ShortcutManager();

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
          if (!isNullOrUndefined(file)) {
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

    this.contextmenu.x = event.layerX - 20;
    this.contextmenu.y = event.layerY;
    this.contextmenu.hidden = false;
  }

  onContextBlur() {
    this.contextmenu.hidden = true;
  }

  onRowSelected(entry: (Task | TaskDirectory), operation: Operation) {
    if ((isNullOrUndefined(operation) || !(operation instanceof ToolOperation))) {

      console.log(`OKOKOKOKOKO hier: ${this.shortcutManager.pressedKey.name}`);
      if (this.shortcutManager.pressedKey.name === 'CMD' || this.shortcutManager.pressedKey.name === 'CTRL') {
        // select

        const search = this.selected_tasks.findIndex((a) => {
          return a.id === entry.id;
        });

        if (search > -1) {
          this.selected_tasks.splice(search, 1);
        } else {
          if (entry instanceof Task) {
            if (!isNullOrUndefined(entry.directory)) {
              const index = this.selected_tasks.findIndex((a) => {
                return (a.id === entry.directory.id);
              });

              if (index < 0) {
                this.selected_tasks.push(entry);
              } else {
                const dir: TaskDirectory = <TaskDirectory> this.selected_tasks[index];
                // folder selected but entry should be removed
                this.selected_tasks.splice(index, 1);

                for (let i = 0; i < dir.entries.length; i++) {
                  const dirEntry = dir.entries[i];

                  if (dirEntry.id !== entry.id) {
                    this.selected_tasks.push(dirEntry);
                  }
                }
              }
            } else {
              this.selected_tasks.push(entry);
            }
          } else {
            // remove all dirEntries in selectedTasks
            for (let i = 0; i < entry.entries.length; i++) {
              const dirEntry = entry.entries[i];

              const index = this.selected_tasks.findIndex((a) => {
                return (a.id === dirEntry.id);
              });

              if (index > -1) {
                this.selected_tasks.splice(index, 1);
              }
            }

            this.selected_tasks.push(entry);
          }
        }

        const puffer = [];
        for (let i = 0; i < this.selected_tasks.length; i++) {
          const task = this.selected_tasks[i];
          if (puffer.find((a) => {
            return task.id === a.id;
          }) === undefined) {
            puffer.push(task);
          }
        }
        this.selected_tasks = puffer;
        console.log(`SELECTED:`);
        console.log(puffer);
      } else {
        // deselect all

        if (this.shortcutManager.pressedKey.name === 'SHIFT') {
          // shift pressed
          if (this.shiftStart > -1) {
            let end = entry.id;

            if (this.shiftStart > end) {
              console.log(`SWITCH`);
              const temp = this.shiftStart;
              this.shiftStart = end;
              end = temp;
            }

            for (let i = 0; i < this.taskList.getAllTasks().length; i++) {
              const task = this.taskList.getAllTasks()[i];
              if (task.id >= this.shiftStart && task.id <= end) {
                this.selected_tasks.push(task);
              }
            }
            // select all between
            // const start =x
            this.shiftStart = -1;
          }
        } else {
          const old_id = (this.selected_tasks.length > 0) ? this.selected_tasks[0].id : -1;

          this.selected_tasks = [];

          if (entry.id !== old_id) {
            this.shiftStart = entry.id;
            this.selected_tasks.push(entry);
          }
        }
      }
    }

    if (
      (!isNullOrUndefined(operation) && !isNullOrUndefined(operation.previousOperation) && operation.previousOperation.results.length > 0 &&
        operation.previousOperation.results[operation.previousOperation.results.length - 1].online
      )
      || (!isNullOrUndefined(operation) && operation.results.length > 0 && operation.results[operation.results.length - 1].online)
      || (!isNullOrUndefined(operation) && operation.name === 'OCTRA' && operation.state !== TaskState.PENDING)
    ) {
      this.operationclick.emit(operation);
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
    for (let i = 0; i < this.selected_tasks.length; i++) {
      const entry = this.selected_tasks[i];

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
    if (entry instanceof Task) {
      const search = this.selected_tasks.findIndex((a) => {
        return a instanceof Task && (<Task> a).id === entry.id
      });

      if (search > -1) {
        return true;
      } else if (!isNullOrUndefined(entry.directory)) {
        return this.isEntrySelected(entry.directory);
      }
    } else {
      const search = this.selected_tasks.findIndex((a) => {
        return a instanceof TaskDirectory && (<TaskDirectory> a).id === entry.id
      });

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

  onTaskMouseEnter($event, task: Task, td: HTMLTableDataCellElement) {
    // show Popover for normal operations only
    console.log($event);
    const y = $event.layerY + 10;
    this.popover.task = task;
    this.popover.x = $event.layerX + 10;
    this.popover.width = 600;
    this.popover.height = 320;
    this.popover.pointer = (y + this.popoverRef.height > window.innerHeight) ? 'bottom-left' : 'left';
    this.popover.y = (y + this.popoverRef.height > window.innerHeight) ? y - this.popoverRef.height : y;
    console.log(`set to ${this.popover.y}`);
    this.togglePopover(true);

    this.popover.operation = null;
  }

  onTaskMouseLeave($event, task: Task) {
    this.togglePopover(false);
    task.mouseover = false;
  }

  onTaskMouseOver($event, task: Task) {
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
    if (!isNullOrUndefined(operation)) {
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
    console.log(event);
    this.shortcutManager.checkKeyEvent(event).then((result) => {
      if (result.command === 'remove') {
        this.popover.state = 'closed';
        this.deleteSelectedTasks();
      } else if (result.command == 'select all') {
        this.selected_tasks = [];
        if (!this.allSelected) {
          this.selected_tasks = this.taskService.taskList.entries.slice(0);
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
    for (let i = 0; i < this.selected_tasks.length; i++) {
      let entry = this.selected_tasks[i];

      this.taskService.taskList.removeEntry(entry, true).catch((error) => {
        console.log(`remove selected false`);
        console.error(error);
      });
    }

    this.selected_tasks = [];
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
}
