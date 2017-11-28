import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';

@Component({
  selector   : 'app-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls  : [ './context-menu.component.css' ]
})
export class ContextMenuComponent implements OnInit {

  @Input() selected_tasks: number[] = [];
  @Output() deletetasks: EventEmitter<void> = new EventEmitter<void>();

  @Input() hid = true;

  constructor() {
  }

  ngOnInit() {
  }

  onDeleteTasks() {
    this.deletetasks.emit();
    this.hid = true;
  }
}
