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
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {FileInfo} from '../../obj/fileInfo';
import {TaskService} from '../../obj/tasks/task.service';
import {DirectoryInfo} from '../../obj/directoryInfo';
import {OCTRAOperation} from '../../obj/tasks/octra-operation';
import * as moment from 'moment';
import {StorageService} from '../../storage.service';
import {Operation} from '../../obj/tasks/operation';
import {ToolOperation} from '../../obj/tasks/tool-operation';
import {EmuOperation} from '../../obj/tasks/emu-operation';
import {ASROperation} from '../../obj/tasks/asr-operation';
import {QueueItem} from '../../obj/preprocessor';
import {FilePreviewModalComponent} from '../../modals/file-preview-modal/file-preview-modal.component';

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
  private pressedKey = -1;
  private shiftStart = -1;

  @Input() shortstyle = false;

  @Output() public afterdrop: EventEmitter<(FileInfo | DirectoryInfo)[]> = new EventEmitter<(FileInfo | DirectoryInfo)[]>();
  @Output() public operationclick: EventEmitter<Operation> = new EventEmitter<Operation>();
  @Output() public operationhover: EventEmitter<Operation> = new EventEmitter<Operation>();
  @ViewChild('content') content;

  @ViewChild('popoverRef') public popoverRef: PopoverComponent;
  @ViewChild('filePreview') public filePreview: FilePreviewModalComponent;

  public selectedOperation: Operation;

  constructor(public sanitizer: DomSanitizer, private cd: ChangeDetectorRef, public taskService: TaskService, private http: HttpClient,
              private modalService: NgbModal, private storage: StorageService) {
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
    if (isNullOrUndefined(operation) || !(operation instanceof ToolOperation)) {

      const search = this.selected_tasks.findIndex((a) => {
        return a.id === entry.id;
      });

      if (search > -1) {
        this.selected_tasks.splice(search, 1);
      } else {
        if (this.shiftStart < 0) {
          this.shiftStart = entry.id;
          this.selected_tasks.push(entry);
        }
        if (this.pressedKey === 16) {
          // shift pressed
          if (this.shiftStart < 0) {
          } else {
            console.log(`select all tasks to ${this.shiftStart}`);
            let end = entry.id;

            if (this.shiftStart > end) {
              const temp = this.shiftStart;
              this.shiftStart = end;
              end = temp;
            }

            for (let i = 0; i < this.taskList.getAllTasks().length; i++) {
              const task = this.taskList.getAllTasks()[i];
              if (task.id > this.shiftStart && task.id <= end) {
                this.selected_tasks.push(task);
              }
            }
            // select all between
            // const start =x
            this.shiftStart = -1;
          }
        } else {
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
    } else if (option === 'compress') {
      this.contextmenu.hidden = false;
      this.openContentModal(this.selectedOperation);
    } else if (option === 'appendings-remove') {
      this.removeAppendings();
    }
    this.contextmenu.hidden = true;
  }

  openContentModal(selectedOperation: Operation) {
    if (!(selectedOperation instanceof UploadOperation || selectedOperation instanceof EmuOperation)) {
      // prepare package
      let dateStr = moment().format('YYYY-MM-DD_H-mm-ss');
      let requestPackage = {
        requestType: 'createArchieve',
        data: {
          archieveName: `${selectedOperation.name}Results_${dateStr}`,
          files: []
        }
      };
      let tasks = this.taskList.getAllTasks();
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        for (let i = 0; i < task.operations.length; i++) {
          const operation = task.operations[i];

          // TODO improve code!
          if (operation.name === selectedOperation.name
            && operation.results.length > 0
          ) {
            for (let i = 0; i < operation.results.length; i++) {
              const result: FileInfo = operation.results[i];

              if (result.online) {
                if (i > 0) {
                  requestPackage.data.files.push({
                    name: result.name + `_${i + 1}.${result.extension}`,
                    url: result.url
                  })
                } else {
                  requestPackage.data.files.push({
                    name: result.fullname,
                    url: result.url
                  })
                }
              }
            }
            break;
          }
        }
      }

      this.http.post('https://www.phonetik.uni-muenchen.de/apps/octra/zAPI/', requestPackage).subscribe(
        (response: any) => {
          this.archiveURL = response.result;
          this.openArchiveDownlaod(this.content);
        },
        (error) => {
          console.error(error);
        }
      );
    } else {
    }
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
    if (!(operation instanceof EmuOperation) && !(operation.state === TaskState.PENDING)) {
      this.popover.operation = operation;
      if (operation.protocol !== '') {
        this.popover.width = 500;
      } else {
        this.popover.width = 400;
      }
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
    operation.onMouseOver();
    this.operationhover.emit();
  }

  onTaskMouseEnter($event, task: Task) {
    // show Popover for normal operations only
    this.popover.task = task;
    this.popover.x = $event.offsetX + 60;
    this.popover.width = 600;
    this.popover.pointer = ($event.layerY + this.popoverRef.height > window.innerHeight) ? 'bottom-left' : 'left';
    this.popover.y = ($event.layerY + this.popoverRef.height > window.innerHeight) ? $event.layerY - this.popoverRef.height : $event.layerY;
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
    console.log(`operation clicked before!`);
    if (operation instanceof UploadOperation || operation instanceof EmuOperation) {
      this.selectedOperation = undefined;
    } else {
      this.selectedOperation = operation;
    }
    this.operationclick.emit(operation);
  }

  openArchiveDownlaod(content) {
    this.modalService.open(content).result.then((result) => {
      this.closeResult = `Closed with: ${result}`;
    });
  }

  @HostListener('window:keydown', ['$event'])
  @HostListener('window:keyup', ['$event'])
  onKeyUp(event: KeyboardEvent) {
    if (event.type === 'keydown') {
      console.log(event.keyCode);
      if (this.pressedKey < 0) {
        this.pressedKey = event.keyCode;
      } else {
        if (event.keyCode === 8 && (this.pressedKey === 93 || this.pressedKey === 224)) {
          // CMD + Backspace on Mac
          event.preventDefault();
          this.deleteSelectedTasks();
        }
      }
    } else if (event.type === 'keyup') {
      if (event.keyCode === this.pressedKey) {
        this.pressedKey = -1;
      }
    }
  }

  private deleteSelectedTasks() {
    for (let i = 0; i < this.selected_tasks.length; i++) {
      let entry = this.selected_tasks[i];

      this.storage.removeFromDB(entry).then(() => {
        if (entry instanceof Task) {
          if (isNullOrUndefined(entry.directory)) {
            this.taskList.removeEntry(entry);
          } else if (entry.directory.entries.length === 1) {
            this.taskList.removeDir(entry.directory);
            (<Task> entry.directory.entries[0]).directory = null;
            this.taskList.addEntry(entry.directory.entries[0]);
          }
        } else {
          this.taskList.removeDir(entry);
        }
      }).catch((err) => {
        console.error(err);
      });

      this.selected_tasks.splice(i, 1);
      i--; // because length changed
    }
  }

  public onPreviewClick(file: FileInfo) {
    console.log(`preview clicked!!`);
    this.filePreview.open(file);
  }
}
