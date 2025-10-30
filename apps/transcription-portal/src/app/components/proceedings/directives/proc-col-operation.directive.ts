import {
  AfterViewInit,
  Directive,
  DoCheck,
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
import { hasProperty, SubscriptionManager } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Subscription } from 'rxjs';
import { Operation } from '../../../obj/operations/operation';
import { Task } from '../../../obj/tasks';
import { TaskService } from '../../../obj/tasks/task.service';
import { TPortalFileInfo } from '../../../obj/TPortalFileInfoAttributes';

@Directive({
  selector: '[tportalProcColOperation]',
})
export class ProcColOperationDirective implements AfterViewInit, OnChanges, OnDestroy {
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);
  private taskService = inject(TaskService);

  @Input() set entry(value: Task | undefined) {
    this._entry = value;
    this.updateView();
  }
  @Input() set operation(value: Operation | undefined) {
    this._operation = value;
    this.updateView();
  }

  _operation?: Operation;
  _entry?: Task;
  @Input() shortStyle = false;
  @Input() mouseOver = false;

  @Output() appendClick: EventEmitter<TPortalFileInfo> = new EventEmitter<TPortalFileInfo>();

  @Output() operationMouseEnter: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() operationMouseLeave: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() operationMouseOver: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  @Output() deleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  private subscrmanager = new SubscriptionManager<Subscription>();

  ngOnChanges(changes: SimpleChanges) {
    if (hasProperty(changes, 'shortStyle') && changes['shortStyle'].currentValue !== undefined) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'max-width', this.shortStyle ? '150px' : 'auto');
    }
    this.updateView();
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  ngAfterViewInit() {
    if (!(this._entry === null || this._entry === undefined)) {
      // entry set
      if (!(this._entry.files === null || this._entry.files === undefined)) {
        this.updateView();
      } else {
        throw new Error('ProcOperationDirective error: entry of type Task does not have any files');
      }
    } else {
      throw new Error('ProcOperationDirective error: no entry set');
    }

    // listen to operation changes because these are not detected by default
    if (this._operation) {
      this.subscrmanager.add(
        this._operation.changes$.subscribe(() => {
          this.updateView();
        }),
      );

      this.subscrmanager.add(
        this._operation.changes$.subscribe(() => {
          this.updateView();
        }),
      );
    }
  }

  private updateView() {
    if (this.elementRef.nativeElement) {
      this.clearContents();

      if (this._entry) {
        this.renderer.setStyle(this.elementRef.nativeElement, 'text-align', 'center');

        if (this._operation) {
          const anyResultNotAvailable = this._operation.lastRound?.results.map((a) => a.available).includes(false) ?? false;

          if (this._operation.state === 'FINISHED' && anyResultNotAvailable) {
            // result is not available
            const icon = this.renderer.createElement('i');

            this.renderer.addClass(icon, 'bi');
            this.renderer.addClass(icon, 'bi-wifi-off');
            this.renderer.setAttribute(icon, 'aria-hidden', 'true');
            this.renderer.appendChild(this.elementRef.nativeElement, icon);
          } else {
            // result is available
            if (this._operation.enabled) {
              let icon = null;
              if (!(this._operation.mouseover && this._operation.state === 'ERROR')) {
                const wrapper = this.renderer.createElement('div');
                this.renderer.setStyle(wrapper, 'display', 'inline');
                wrapper.innerHTML = this._operation.getStateIcon2(this._operation.state);

                this.renderer.listen(wrapper, 'mouseover', this.onMouseOver);
                this.renderer.listen(wrapper, 'mouseenter', this.onMouseEnter);
                this.renderer.listen(wrapper, 'mouseleave', this.onMouseLeave);
                this.renderer.appendChild(this.elementRef.nativeElement, wrapper);
              } else {
                icon = this.renderer.createElement('i');
                this.renderer.addClass(icon, 'bi');
                this.renderer.addClass(icon, 'bi-arrow-clockwise');
                this.renderer.setAttribute(icon, 'aria-hidden', 'true');
                this.renderer.appendChild(this.elementRef.nativeElement, icon);

                this.renderer.listen(icon, 'click', this.onRepeatIconClick);
              }

              this.renderer.removeClass(this.elementRef.nativeElement, 'op-deactivated');
            } else {
              // operation disabled
              this.renderer.addClass(this.elementRef.nativeElement, 'op-deactivated');

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
        throw new Error('ProcOperationDirective error: entry is not of type Task');
      }
    } else {
      throw new Error('ProcOperationDirective error: updateView: nativeElement is undefined');
    }
  }

  private clearContents() {
    for (let i = 0; i < (this.elementRef.nativeElement as HTMLElement).children.length; i++) {
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
    if (this._entry?.operations && this._entry.operations[1].serviceProvider) {
      this._entry.restartFailedOperation(this.taskService.httpclient, [
        {
          name: 'GoogleASR',
          value: this.taskService.accessCode,
        },
      ]);
    }
  };
}
