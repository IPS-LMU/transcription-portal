import {AfterViewInit, Directive, ElementRef, Input, OnChanges, Renderer2, SimpleChanges} from '@angular/core';
import {isNullOrUndefined} from 'util';
import {Operation} from '../../../obj/operations/operation';
import {Task, TaskDirectory} from '../../../obj/tasks';

@Directive({
  selector: '[appProceedingsRow]'
})
export class ProceedingsRowDirective implements OnChanges, AfterViewInit {

  @Input() entry: (Task | TaskDirectory);
  @Input() toolSelectedOperation: Operation;
  @Input() rowSelected = false;

  private get toolSelected(): boolean {
    return ((this.toolSelectedOperation !== undefined
      && this.toolSelectedOperation.task !== undefined)
      && this.toolSelectedOperation.task.id === this.entry.id);
  }

  constructor(private elementRef: ElementRef, private renderer: Renderer2) {
    renderer.setStyle(elementRef.nativeElement, 'cursor', 'pointer');
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('toolSelectedOperation')) {
      if (this.toolSelected) {
        this.renderer.addClass(this.elementRef.nativeElement, 'tool-selected');
      } else {
        this.renderer.removeClass(this.elementRef.nativeElement, 'tool-selected');
      }
    }

    if (changes.hasOwnProperty('rowSelected') && changes.rowSelected.currentValue !== undefined) {
      if (this.rowSelected) {
        this.renderer.addClass(this.elementRef.nativeElement, 'selected');
      } else {
        this.renderer.removeClass(this.elementRef.nativeElement, 'selected');
      }
    }
  }

  ngAfterViewInit() {
    if (!isNullOrUndefined(this.entry)) {
      // entry set

    } else {
      throw new Error('ProceedingsRowDirective error: no entry set');
    }
  }
}
