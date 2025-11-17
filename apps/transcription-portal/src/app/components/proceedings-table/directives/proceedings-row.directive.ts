import { AfterViewInit, Directive, ElementRef, Input, OnChanges, Renderer2, SimpleChanges, inject } from '@angular/core';
import { hasProperty } from '@octra/utilities';
import { StoreItem, StoreTaskOperation } from '../../../store';

@Directive({
  selector: '[tportalProceedingsRow]',
  standalone: true,
})
export class ProceedingsRowDirective implements OnChanges, AfterViewInit {
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  @Input() entry?: StoreItem;
  @Input() toolSelectedOperation?: {
    operation?: StoreTaskOperation | null;
  } | null;
  @Input() rowSelected? = false;

  constructor() {
    const elementRef = this.elementRef;
    const renderer = this.renderer;

    renderer.setStyle(elementRef.nativeElement, 'cursor', 'pointer');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (hasProperty(changes, 'toolSelectedOperation')) {
      if (this.toolSelectedOperation) {
        this.renderer.addClass(this.elementRef.nativeElement, 'tool-selected');
      } else {
        this.renderer.removeClass(this.elementRef.nativeElement, 'tool-selected');
      }
    }

    if (hasProperty(changes, 'rowSelected') && changes['rowSelected'].currentValue !== undefined) {
      if (this.rowSelected) {
        this.renderer.addClass(this.elementRef.nativeElement, 'row-selected');
      } else {
        this.renderer.removeClass(this.elementRef.nativeElement, 'row-selected');
      }
    }
  }

  ngAfterViewInit() {
    if (!(this.entry === null || this.entry === undefined)) {
      // entry set
    } else {
      throw new Error('ProceedingsRowDirective error: no entry set');
    }
  }
}
