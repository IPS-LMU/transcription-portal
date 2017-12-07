import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { isNullOrUndefined } from 'util';
import { ANIMATIONS } from '../../shared/Animations';

import { Operation, Task, TaskState, ToolOperation } from '../../shared/tasks/obj';
import { FileInfo } from '../../shared/tasks/obj/fileInfo';
import { TaskService } from '../../shared/tasks/task.service';

declare var window: any;

@Component({
  selector       : 'app-proceedings',
  templateUrl    : './proceedings.component.html',
  styleUrls      : [ './proceedings.component.css' ],
  animations     : ANIMATIONS,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProceedingsComponent implements OnInit, OnDestroy {

  public contextmenu = {
    x     : 0,
    y     : 0,
    hidden: true
  };

  public popover = {
    x        : 0,
    y        : 0,
    state    : 'closed',
    width    : 200,
    operation: null
  };

  @Input() tasks: Task[] = [];
  @Input() operations: Operation[] = [];
  private fileAPIsupported = false;
  public selected_tasks = [];

  @Input() shortstyle = false;

  @Output() public afterdrop: EventEmitter<FileInfo[]> = new EventEmitter<FileInfo[]>();
  @Output() public operationclick: EventEmitter<Operation> = new EventEmitter<Operation>();

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
    if (!this.cd[ 'destroyed' ]) {
      this.cd.detectChanges();
    }

    setInterval(() => {
      if (!this.cd[ 'destroyed' ]) {
        this.cd.detectChanges();
      }
    }, 500);
  }

  ngOnDestroy() {
    console.log('destroy proceedings');
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

    if (this.fileAPIsupported) {

      const droppedfiles: FileList = $event.dataTransfer.files;
      const files: FileInfo[] = [];

      for (let i = 0; i < droppedfiles.length; i++) {
        const file = droppedfiles[ i ];
        files.push(FileInfo.fromFileObject(file));
      }

      this.afterdrop.emit(files);

      this.cd.markForCheck();
      this.cd.detectChanges();
    }
  }

  onContextMenu(event) {
    event.preventDefault();
    console.log(event);

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
        if (a.id === this.selected_tasks[ i ]) {
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
    if (!(operation instanceof ToolOperation) && !(operation.state === TaskState.PENDING || operation.state === TaskState.READY)) {
      this.popover.operation = operation;
      this.popover.x = $event.target.offsetLeft + ($event.target.offsetWidth / 2) - (this.popover.width / 2);
      this.popover.y = $event.target.offsetTop + $event.target.offsetHeight;
      this.togglePopover(true);
    }
  }

  onOperationMouseLeave($event, operation: Operation) {
    if (!(operation instanceof ToolOperation) && !(operation.state === TaskState.PENDING || operation.state === TaskState.READY)) {
      this.togglePopover(false);
    }
    operation.mouseover = false;
  }

  onOperationMouseOver($event, operation: Operation) {
    operation.mouseover = true;
  }

  calculateDuration(start: number, end?: number) {
    if (isNullOrUndefined(end) || end === 0) {
      return (Date.now() - start);
    } else {
      return (end - start);
    }
  }
}
