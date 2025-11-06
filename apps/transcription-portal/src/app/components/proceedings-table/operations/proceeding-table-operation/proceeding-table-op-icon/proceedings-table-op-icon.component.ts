import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { StoreTaskOperation, TaskStatus } from '../../../../../store';

@Component({
  selector: 'tportal-proceedings-table-op-icon',
  templateUrl: './proceedings-table-op-icon.component.html',
  styleUrls: ['./proceedings-table-op-icon.component.scss'],
})
export class ProceedingsTableOpIconComponent extends SubscriberComponent implements OnChanges {
  @Input() storeTaskOperation?: StoreTaskOperation;

  constructor() {
    super();
  }

  ngOnChanges(changes: SimpleChanges) {}

  protected readonly TaskStatus = TaskStatus;
}
