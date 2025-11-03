import { Component, ElementRef, inject, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { StoreTaskOperation } from '../../../store';
import { ProceedingsTableAsrOperationComponent,
  ProceedingsTableToolOperationComponent, ProceedingsTableUploadOperationComponent,
  ProceedingsTableWordAlignmentOperationComponent
} from '../operations';

@Component({
  selector: 'tportal-proceedings-table-operation-selector',
  templateUrl: './proceedings-table-operation-selector.component.html',
  imports: [
    ProceedingsTableUploadOperationComponent,
    ProceedingsTableAsrOperationComponent,
    ProceedingsTableToolOperationComponent,
    ProceedingsTableWordAlignmentOperationComponent,
  ],
  styleUrls: ['./proceedings-table-operation-selector.component.scss'],
})
export class ProceedingsTableOperationSelectorComponent extends SubscriberComponent implements OnChanges {
  @Input() storeTaskOperation?: StoreTaskOperation;
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  constructor() {
    super();
  }

  ngOnChanges(changes: SimpleChanges) {}
}
