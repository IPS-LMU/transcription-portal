import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { hasProperty, SubscriptionManager } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Subscription } from 'rxjs';
import { Operation } from '../../../obj/operations/operation';
import { Task } from '../../../obj/tasks';
import { TaskService } from '../../../obj/tasks/task.service';

@Directive({
  selector: '[tportalProcColOperation]',
  standalone: true,
})
export class ProcColOperationDirective
  implements AfterViewInit, OnChanges, OnDestroy
{
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);
  private sanitizer = inject(DomSanitizer);
  private taskService = inject(TaskService);

  @Input() entry?: Task;
  @Input() operation?: Operation;
  @Input() shortStyle = false;
  @Input() mouseOver = false;

  @Output() appendClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();

  @Output() operationMouseEnter: EventEmitter<MouseEvent> =
    new EventEmitter<MouseEvent>();
  @Output() operationMouseLeave: EventEmitter<MouseEvent> =
    new EventEmitter<MouseEvent>();
  @Output() operationMouseOver: EventEmitter<MouseEvent> =
    new EventEmitter<MouseEvent>();

  @Output() deleteIconClick: EventEmitter<MouseEvent> =
    new EventEmitter<MouseEvent>();

  private subscrmanager = new SubscriptionManager<Subscription>();

  ngOnChanges(changes: SimpleChanges) {
    if (
      hasProperty(changes, 'shortStyle') &&
      changes['shortStyle'].currentValue !== undefined
    ) {
      this.renderer.setStyle(
        this.elementRef.nativeElement,
        'max-width',
        this.shortStyle ? '150px' : 'auto',
      );
    }
    this.updateView();
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  ngAfterViewInit() {
    if (!(this.entry === null || this.entry === undefined)) {
      // entry set
      if (!(this.entry.files === null || this.entry.files === undefined)) {
        this.updateView();
      } else {
        throw new Error(
          'ProcOperationDirective error: entry of type Task does not have any files',
        );
      }
    } else {
      throw new Error('ProcOperationDirective error: no entry set');
    }

    // listen to operation changes because these are not detected by default
    if (this.operation) {
      this.subscrmanager.add(
        this.operation.statechange.subscribe(() => {
          this.updateView();
        }),
      );

      this.subscrmanager.add(
        this.operation.changed.subscribe(() => {
          this.updateView();
        }),
      );
    }
  }

  private updateView() {
    if (
      !(
        this.elementRef.nativeElement === null ||
        this.elementRef.nativeElement === undefined
      )
    ) {
      this.clearContents();

      if (this.entry) {
        this.renderer.setStyle(
          this.elementRef.nativeElement,
          'text-align',
          'center',
        );

        if (this.operation) {
          if (
            this.operation.state === 'FINISHED' &&
            this.operation.results.length > 0 &&
            this.operation.lastResult &&
            !this.operation.lastResult.available
          ) {
            // result is not available
            const icon = this.renderer.createElement('i');

            this.renderer.addClass(icon, 'bi');
            this.renderer.addClass(icon, 'bi-wifi-off');
            this.renderer.setAttribute(icon, 'aria-hidden', 'true');
            this.renderer.appendChild(this.elementRef.nativeElement, icon);
          } else {
            // result is available
            if (this.operation.enabled) {
              let icon = null;
              if (
                !(this.operation.mouseover && this.operation.state === 'ERROR')
              ) {
                const wrapper = this.renderer.createElement('div');
                this.renderer.setStyle(wrapper, 'display', 'inline');
                wrapper.innerHTML = this.operation.getStateIcon2(
                  this.operation.state,
                );

                this.renderer.listen(wrapper, 'mouseover', this.onMouseOver);
                this.renderer.listen(wrapper, 'mouseenter', this.onMouseEnter);
                this.renderer.listen(wrapper, 'mouseleave', this.onMouseLeave);
                this.renderer.appendChild(
                  this.elementRef.nativeElement,
                  wrapper,
                );
              } else {
                icon = this.renderer.createElement('i');
                this.renderer.addClass(icon, 'bi');
                this.renderer.addClass(icon, 'bi-arrow-clockwise');
                this.renderer.setAttribute(icon, 'aria-hidden', 'true');
                this.renderer.appendChild(this.elementRef.nativeElement, icon);

                this.renderer.listen(icon, 'click', this.onRepeatIconClick);
              }

              this.renderer.removeClass(
                this.elementRef.nativeElement,
                'op-deactivated',
              );
            } else {
              // operation disabled
              this.renderer.addClass(
                this.elementRef.nativeElement,
                'op-deactivated',
              );

              const icon = this.renderer.createElement('i');
              this.renderer.addClass(icon, 'bi');
              this.renderer.addClass(icon, 'bi-arrow-right-circle');
              this.renderer.setStyle(icon, 'color', 'gray');
              this.renderer.setAttribute(icon, 'aria-hidden', 'true');
              this.renderer.appendChild(this.elementRef.nativeElement, icon);
            }
          }
        }
      } else {
        throw new Error(
          'ProcOperationDirective error: entry is not of type Task',
        );
      }
    } else {
      throw new Error(
        'ProcOperationDirective error: updateView: nativeElement is undefined',
      );
    }
  }

  private clearContents() {
    for (
      let i = 0;
      i < (this.elementRef.nativeElement as HTMLElement).children.length;
      i++
    ) {
      const child = this.elementRef.nativeElement.children[i];

      if (!(child === null || child === undefined)) {
        const oldLength = this.elementRef.nativeElement.children.length;
        this.renderer.removeChild(this.elementRef.nativeElement, child);
        if (oldLength > this.elementRef.nativeElement.children.length) {
          i--;
        }
      }
    }
  }

  private onMouseOver = (event: MouseEvent) => {
    this.operationMouseOver.next(event);
  };

  private onMouseEnter = (event: MouseEvent) => {
    this.operationMouseEnter.next(event);
  };

  private onMouseLeave = (event: MouseEvent) => {
    this.operationMouseLeave.next(event);
  };

  private onRepeatIconClick = () => {
    if (this.entry?.operations && this.entry.operations[1].serviceProvider) {
      this.entry.restartFailedOperation(this.taskService.httpclient, [
        {
          name: 'GoogleASR',
          value: this.taskService.accessCode,
        },
      ]);
    }
  };
}
