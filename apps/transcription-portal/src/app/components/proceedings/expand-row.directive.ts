import {Directive, ElementRef, OnInit, Renderer2} from '@angular/core';

@Directive({
    selector: '[appExpandRow]',
    standalone: true
})
export class ExpandRowDirective implements OnInit {

  constructor(private elRef: ElementRef, private renderer: Renderer2) {
  }

  ngOnInit() {
    const native = this.elRef.nativeElement;
    this.renderer.listen(native, 'click', () => {
      const state = native.getAttribute('data-state');
      if (!state) {
        this.renderer.setAttribute(native, 'data-state', 'opened');
      } else {
        if (state === 'opened') {
          this.renderer.setAttribute(native, 'data-state', 'closed');
        } else {
          this.renderer.setAttribute(native, 'data-state', 'opened');
        }
      }

      if (native.getAttribute('data-state') === 'closed') {
        this.renderer.setAttribute(native, 'class', 'fa fa-angle-down');
      } else {
        this.renderer.setAttribute(native, 'class', 'fa fa-angle-up');
      }
    });
  }
}
