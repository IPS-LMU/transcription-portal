import { Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Operation } from '../../../obj/operations/operation';
import { Task, TaskStatus } from '../../../obj/tasks';
import { TaskService } from '../../../obj/tasks/task.service';

@Component({
  selector: 'tportal-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  standalone: true,
  imports: [TranslocoPipe],
})
export class ContextMenuComponent implements OnChanges {
  @Input() selectedTasks: number[] = [];
  @Input() selectedOperationType?: Operation;
  @Output() optionselected: EventEmitter<string> = new EventEmitter<string>();
  taskService: TaskService = inject(TaskService);

  @Input() hid = true;

  public get entriesCount(): number {
    return this.selectedTasks.length;
  }

  protected tasks: {
    enabled: Task[];
    disabled: Task[];
  } = {
    enabled: [],
    disabled: [],
  };

  get firstSelectedTask(): Task | undefined {
    if (this.selectedTasks.length === 1) {
      const found = this.taskService.currentModeState?.taskList?.getEntryByIndex(this.selectedTasks[0]);
      if (found && found instanceof Task) {
        return found;
      }
    }
    return undefined;
  }

  onAction(action: string) {
    this.optionselected.emit(action);
    this.hid = true;
  }

  onCompress() {
    this.optionselected.emit('compress');
    this.hid = false;
  }

  public onRemoveAttachments() {
    this.optionselected.emit('appendings-remove');
  }

  disableTasks(disable: boolean) {
    if (disable) {
      this.optionselected.emit('disable-tasks');
    } else {
      this.optionselected.emit('enable-tasks');
    }
  }

  ngOnChanges(changes: SimpleChanges) {
  }
}
