import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { isNullOrUndefined } from 'util';
import { ANIMATIONS } from '../../shared/Animations';

import { Operation, Task } from '../../shared/tasks/obj';
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
export class ProceedingsComponent implements OnInit {

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

  @Output() public afterdrop: EventEmitter<FileInfo[]> = new EventEmitter<FileInfo[]>();

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
    setInterval(() => {
      this.cd.detectChanges();
    }, 500);
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

  onRowSelected(taskID: number) {
    const search = this.selected_tasks.indexOf(taskID);
    if (search > -1) {
      this.selected_tasks.splice(search, 1);
    } else {
      this.selected_tasks.push(taskID);
    }
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

  togglePopover() {
    if (this.popover.state === 'closed') {
      this.popover.state = 'opened';
    } else {
      this.popover.state = 'closed';
    }
  }

  onOperationMouseEnter($event, operation: Operation) {
    console.log($event);
    this.popover.operation = operation;
    this.popover.x = $event.target.offsetLeft + ($event.target.offsetWidth / 2) - (this.popover.width / 2);
    this.popover.y = $event.target.offsetTop + $event.target.offsetHeight;
    this.togglePopover();
  }

  onOperationMouseLeave($event) {
    this.togglePopover();
  }

  calculateDuration(start: number, end?: number) {
    if (isNullOrUndefined(end) || end === 0) {
      return (Date.now() - start);
    } else {
      return (end - start);
    }
  }
}
