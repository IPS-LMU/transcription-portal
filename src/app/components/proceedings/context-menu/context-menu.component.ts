import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Operation} from '../../../obj/tasks/operation';

@Component({
  selector: 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.css']
})
export class ContextMenuComponent implements OnInit {

  @Input() selected_tasks: number[] = [];
  @Input() selectedOperationType: Operation;
  @Output() optionselected: EventEmitter<string> = new EventEmitter<string>();

  @Input() hid = true;

  constructor() {
  }

  ngOnInit() {
  }

  onAction(action: string) {
    this.optionselected.emit(action);
    this.hid = true;
  }

  onCompress() {
    this.optionselected.emit('compress');
    this.hid = false;
  }

  public get entriesCount(): number {
    return this.selected_tasks.length;
  }

  public onRemoveAppendings() {
    this.optionselected.emit('appendings-remove');
  }
}
