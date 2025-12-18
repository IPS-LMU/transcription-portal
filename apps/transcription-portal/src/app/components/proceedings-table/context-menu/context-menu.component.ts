import { Component, ElementRef, EventEmitter, inject, Input, Output, SimpleChanges } from '@angular/core';
import { OperationFactory, StoreItem } from '../../../store';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tportal-context-menu',
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
  standalone: true,
  imports: [TranslocoPipe],
})
export class ContextMenuComponent {
  private elRef = inject(ElementRef);

  @Input() selectedTasks?: StoreItem[] | null = [];
  @Input() selectedOperationType?: OperationFactory;
  @Output() optionselected: EventEmitter<string> = new EventEmitter<string>();

  @Input() hid = true;

  get offsetHeight() {
    return this.elRef.nativeElement.offsetHeight;
  }

  public get entriesCount(): number {
    return (this.selectedTasks ?? []).length;
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
