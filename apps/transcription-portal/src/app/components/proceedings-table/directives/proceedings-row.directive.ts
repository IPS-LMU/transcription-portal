import { AfterViewInit, Directive, ElementRef, Input, OnChanges, Renderer2, SimpleChanges, inject } from '@angular/core';
import { hasProperty } from '@octra/utilities';
import { Operation } from '../../../obj/operations/operation';
import { StoreTask, StoreTaskDirectory } from '../../../store';

@Directive({
  selector: '[tportalProceedingsRow]',
  standalone: true,
})
export class ProceedingsRowDirective implements OnChanges, AfterViewInit {
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  @Input() entry?: StoreTask | StoreTaskDirectory;
  @Input() toolSelectedOperation?: Operation;
  @Input() rowSelected = false;

  constructor() {
    const elementRef = this.elementRef;
    const renderer = this.renderer;

    renderer.setStyle(elementRef.nativeElement, 'cursor', 'pointer');
  }

  private get toolSelected(): boolean {
    return (
      this.toolSelectedOperation !== undefined &&
      this.toolSelectedOperation.task !== undefined &&
      this.toolSelectedOperation.task.id === this.entry?.id
    );
  }

  ngOnChanges(changes: SimpleChanges) {
    if (hasProperty(changes, 'toolSelectedOperation')) {
      if (this.toolSelected) {
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
