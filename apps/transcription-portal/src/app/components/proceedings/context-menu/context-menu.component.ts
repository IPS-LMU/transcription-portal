import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {Operation} from '../../../obj/operations/operation';

@Component({
  selector: 'tportal-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.css']
})
export class ContextMenuComponent implements OnInit {

  @Input() selectedTasks: number[] = [];
  @Input() selectedOperationType?: Operation;
  @Output() optionselected: EventEmitter<string> = new EventEmitter<string>();

  @Input() hid = true;

  constructor() {
  }

  public get entriesCount(): number {
    return this.selectedTasks.length;
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

  public onRemoveAttachments() {
    this.optionselected.emit('appendings-remove');
  }
}
