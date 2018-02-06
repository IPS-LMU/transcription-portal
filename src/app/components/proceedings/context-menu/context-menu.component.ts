import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Operation, Task} from '../../../obj/tasks';
import {TaskDirectory} from '../../../obj/taskDirectory';

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.css']
})
export class ContextMenuComponent implements OnInit {

  @Input() selected_tasks: (Task | TaskDirectory)[] = [];
  @Input() selectedOperationType: Operation;
  @Output() optionselected: EventEmitter<string> = new EventEmitter<string>();

  @Input() hid = true;

  constructor() {
  }

  ngOnInit() {
  }

  onDeleteTasks() {
    this.optionselected.emit('delete');
    this.hid = true;
  }

  onCompress() {
    this.optionselected.emit('compress');
    this.hid = false;
  }

  public get dirCount(): number {
    let test = this.selected_tasks.filter((a) => {
      return (a instanceof TaskDirectory);
    });

    return test.length;
  }

  public get filesCount(): number {
    let test = this.selected_tasks.filter((a) => {
      return (a instanceof Task);
    });

    return test.length;
  }
}
