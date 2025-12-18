import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Operation } from '../../../../obj/operations/operation';
import { Task } from '../../../../obj/tasks';
import { SubscriberComponent } from '@octra/ngx-utilities';

@Component({
  selector: 'tportal-operation-col-base',
  template: "",
  styleUrls: ['./operation-col-base.component.scss'],
  imports: [],
})
export class OperationColBaseComponent extends SubscriberComponent implements OnChanges {
  @Input() operation?: Operation;
  @Input() task?: Task;
  @Input() mouseIn?: boolean;

  ngOnChanges(changes: SimpleChanges) {
  }
}
