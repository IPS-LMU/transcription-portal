import { Directive, ElementRef, inject, Input, OnChanges, Renderer2, SimpleChanges } from '@angular/core';
import { StoreTaskOperation } from '../../../store';

@Directive({
  selector: '[tportalProceedingsTableTd]',
})
export class ProceedingsTableTDDirective implements OnChanges {
  @Input() storeTaskOperation?: StoreTaskOperation;
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  constructor() {}

  ngOnChanges(changes: SimpleChanges) {
    const storeTaskOperation = changes['storeTaskOperation'];
  }
}
