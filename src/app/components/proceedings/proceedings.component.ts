import {
  ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnDestroy, OnInit, Output,
  ViewChild
} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {ANIMATIONS} from '../../shared/Animations';

import {EmuOperation, FileInfo, Operation, Task, TaskService, TaskState, ToolOperation} from '../../shared/tasks';
import {PopoverComponent} from '../popover/popover.component';
import {OCTRAOperation} from '../../shared/tasks/obj/octra-operation';
import {ASROperation} from '../../shared/tasks/obj';

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

  public popover = {
    x: 0,
    y: 0,
    state: 'closed',
    width: 200,
    operation: null,
    task: null,
    pointer: 'left'
  };

  @Input() tasks: Task[] = [];
  @Input() operations: Operation[] = [];
  private fileAPIsupported = false;
  public selected_tasks = [];

  @Input() shortstyle = false;

  @Output() public afterdrop: EventEmitter<FileInfo[]> = new EventEmitter<FileInfo[]>();
  @Output() public operationclick: EventEmitter<Operation> = new EventEmitter<Operation>();
  @Output() public operationhover: EventEmitter<Operation> = new EventEmitter<Operation>();

  @ViewChild('popoverRef') public popoverRef: PopoverComponent;

  constructor(public sanitizer: DomSanitizer, private cd: ChangeDetectorRef, public taskService: TaskService) {
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

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public getStateIcon(operation: Operation) {
    return operation.getStateIcon(this.sanitizer, operation.state);
  }

  onDrop($event) {
    $event.stopPropagation();
    $event.preventDefault();

    const promises: Promise<void>[] = [];

    if (this.fileAPIsupported) {

      const droppedfiles: FileList = $event.dataTransfer.files;
      const files: FileInfo[] = [];

      for (let i = 0; i < droppedfiles.length; i++) {
        const file = droppedfiles[i];

        const newName = FileInfo.escapeFileName(file.name);

        if (newName !== file.name) {
          // no valid name, replace
          promises.push(FileInfo.renameFile(file, newName, {
            type: file.type,
            lastModified: file.lastModifiedDate
          }).then((newfile: File) => {
            files.push(FileInfo.fromFileObject(newfile));
          }));
        } else {
          files.push(FileInfo.fromFileObject(file));
          this.cd.markForCheck();
          this.cd.detectChanges();
        }
      }

      if (promises.length > 0) {
        Promise.all(promises).then(() => {
          console.log('ALL ended');
          this.afterdrop.emit(files);
          this.cd.markForCheck();
          this.cd.detectChanges();
        });
      } else {
        this.afterdrop.emit(files);
      }
    } else {
      console.error(`file api not supported`);
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

  onRowSelected(taskID: number, operation: Operation) {
    if (!(operation instanceof ToolOperation)) {
      const search = this.selected_tasks.indexOf(taskID);
      if (search > -1) {
        this.selected_tasks.splice(search, 1);
      } else {
        this.selected_tasks.push(taskID);
      }
    }
    this.operationclick.emit(operation);
  }


  onDeleteTasks() {
    for (let i = 0; i < this.selected_tasks.length; i++) {
      const task_index = this.tasks.findIndex((a) => {
        if (a.id === this.selected_tasks[i]) {
          return true;
        }
      });

      this.tasks.splice(task_index, 1);
      this.selected_tasks.splice(i, 1);
      i--; // because length changed
    }
    this.contextmenu.hidden = true;
  }

  isTaskSelected(taskID: number) {
    const search = this.selected_tasks.indexOf(taskID);
    if (search > -1) {
      return true;
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
        this.popover.width = 200;
      }
      if (($event.target.offsetLeft + this.popover.width) < window.innerWidth) {
        this.popover.x = $event.target.offsetLeft + ($event.target.offsetWidth / 2);
        this.popover.pointer = 'left';
      } else {
        this.popover.x = $event.target.offsetLeft - this.popover.width + ($event.target.offsetWidth / 2);
        this.popover.pointer = 'right';
      }

      this.popover.y = $event.target.offsetTop + ($event.target.offsetHeight / 2) + 5;
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
    console.log($event);
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

  calculateDuration(start: number, end?: number) {
    if (isNullOrUndefined(end) || end === 0) {
      return (Date.now() - start);
    } else {
      return (end - start);
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
    operation.enabled = !operation.enabled;
    const previous = this.taskService.operations[index - 1];
    const next = this.taskService.operations[index + 1];
    if (operation instanceof OCTRAOperation) {
      if (!previous.enabled && !operation.enabled) {
        previous.enabled = true;
      }
    } else if (operation instanceof ASROperation) {
      if (!next.enabled && !operation.enabled) {
        next.enabled = true;
      }
    }

    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      const task_operation = task.operations[index];

      if (task_operation.state === TaskState.PENDING) {
        task_operation.enabled = operation.enabled;
      }
    }
  }

  public getPopoverColor(operation): string {
    if (!isNullOrUndefined(operation)) {
      if (operation.state == TaskState.ERROR) {
        return 'red';
      } else if (operation.state === TaskState.FINISHED && operation.protocol !== '') {
        return 'yellow';
      }
    }
    return '#3a70dd'
  }
}
