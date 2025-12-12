import { Component, ElementRef, HostListener, inject, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { StoreTaskOperation } from '../../../../store';
import { ProceedingsTableOpIconComponent } from './proceeding-table-op-icon/proceedings-table-op-icon.component';

@Component({
  selector: 'tportal-proceedings-table-operation',
  templateUrl: './proceedings-table-operation.component.html',
  styleUrls: ['./proceedings-table-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent],
})
export class ProceedingsTableOperationComponent extends SubscriberComponent implements OnChanges {
  @Input() storeTaskOperation?: StoreTaskOperation;
  protected elementRef = inject(ElementRef);
  protected renderer = inject(Renderer2);

  constructor() {
    super();
  }

  @HostListener('mouseover', ['$event'])
  protected onMouseOver($event: MouseEvent) {}

  ngOnChanges(changes: SimpleChanges) {}
}
