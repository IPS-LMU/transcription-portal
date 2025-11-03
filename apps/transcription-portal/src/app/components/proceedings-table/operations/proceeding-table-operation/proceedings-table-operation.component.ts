import { Component, ElementRef, inject, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { StoreTaskOperation } from '../../../../store';

@Component({
  selector: 'tportal-proceedings-table-operation',
  templateUrl: './proceedings-table-operation.component.html',
  styleUrls: ['./proceedings-table-operation.component.scss'],
})
export class ProceedingsTableOperationComponent extends SubscriberComponent implements OnChanges {
  @Input() storeTaskOperation?: StoreTaskOperation;
  protected elementRef = inject(ElementRef);
  protected renderer = inject(Renderer2);

  constructor() {
    super();
  }

  ngOnChanges(changes: SimpleChanges) {}
}
