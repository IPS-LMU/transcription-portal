import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Operation } from '../../../obj/operations/operation';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tportal-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  standalone: true,
  imports: [TranslocoPipe],
})
export class ContextMenuComponent {
  @Input() selectedTasks: number[] = [];
  @Input() selectedOperationType?: Operation;
  @Output() optionselected: EventEmitter<string> = new EventEmitter<string>();

  @Input() hid = true;

  public get entriesCount(): number {
    return this.selectedTasks.length;
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
}
