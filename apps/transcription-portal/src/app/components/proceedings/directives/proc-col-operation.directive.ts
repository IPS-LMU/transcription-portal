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
import { hasProperty, SubscriptionManager } from '@octra/utilities';
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
  @Output() operationRepeatIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() deleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  private subscrmanager = new SubscriptionManager<Subscription>();
  private listeners: Record<string, (() => void)[]> = {
    wrapper: [],
  };

  private wrapper?: HTMLElement;

  ngOnChanges(changes: SimpleChanges) {
    if (hasProperty(changes, 'shortStyle') && changes['shortStyle'].currentValue !== undefined) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'max-width', this.shortStyle ? '150px' : 'auto');
    }
    this.updateView();
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
    this.unlisten('wrapper');
    this.unlisten('icon');
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
    this.unlisten('wrapper');
    setTimeout(() => {
      if (this.elementRef.nativeElement) {
        this.clearContents(this.elementRef.nativeElement);

        if (this._entry) {
          this.renderer.setStyle(this.elementRef.nativeElement, 'text-align', 'center');

          this.wrapper = this.renderer.createElement('div');
          this.renderer.addClass(this.wrapper!, 'text-center');
          this.renderer.addClass(this.wrapper!, 'd-inline-block');

          if (this._operation && this.wrapper) {
            this.listeners['wrapper'] = [
              this.renderer.listen(this.wrapper, 'mouseleave', this.onMouseLeave),
              this.renderer.listen(this.wrapper, 'mouseenter', this.onMouseEnter),
              this.renderer.listen(this.wrapper, 'mouseover', this.onMouseOver),
              this.renderer.listen(this.wrapper, 'click', this.onClick),
            ];

            const anyResultNotAvailable = this._operation.lastRound?.results.map((a) => a.available).includes(false) ?? false;

            if (this._operation.state === 'FINISHED' && anyResultNotAvailable) {
              // result is not available
              const icon = this.renderer.createElement('i');

              this.renderer.addClass(icon, 'bi');
              this.renderer.addClass(icon, 'bi-wifi-off');
              this.renderer.setAttribute(icon, 'aria-hidden', 'true');
              this.renderer.appendChild(this.wrapper, icon);
            } else {
              // result is available
              if (this._operation.enabled) {
                this.renderer.setProperty(this.wrapper, 'innerHTML', this._operation.getStateIcon2(this._operation.state));
                this.renderer.removeClass(this.wrapper, 'op-deactivated');
              } else {
                // operation disabled
                this.renderer.addClass(this.wrapper, 'op-deactivated');

                const icon = this.renderer.createElement('i');
                this.renderer.addClass(icon, 'bi');
                this.renderer.addClass(icon, 'bi-arrow-right-circle');
                this.renderer.setStyle(icon, 'color', 'gray');
                this.renderer.setAttribute(icon, 'aria-hidden', 'true');
                this.renderer.appendChild(this.wrapper, icon);
              }
            }
          }

          this.renderer.appendChild(this.elementRef.nativeElement, this.wrapper);
        } else {
          throw new Error('ProcOperationDirective error: entry is not of type Task');
        }
      } else {
        throw new Error('ProcOperationDirective error: updateView: nativeElement is undefined');
      }
    }, 0);
  }

  private clearContents(root: HTMLElement) {
    for (let i = 0; i < root.children.length; i++) {
      const child = root.children[i];

      if (!(child === null || child === undefined)) {
        const oldLength = root.children.length;
        this.renderer.removeChild(root, child);
        if (oldLength > root.children.length) {
          i--;
        }
      }
    }
  }

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

  onMouseLeave = (event: MouseEvent) => {
    if (this._operation?.state === 'ERROR') {
      this.updateView();
    }
    this.operationMouseLeave.next(event);
  };

  onMouseEnter = (event: MouseEvent) => {
    if (this._operation?.state === 'ERROR') {
      this.unlisten('icon');
      const icon = this.renderer.createElement('i');
      this.renderer.addClass(icon, 'bi');
      this.renderer.addClass(icon, 'bi-arrow-clockwise');
      this.renderer.addClass(icon, 'bi-inline-block');
      this.renderer.setAttribute(icon, 'aria-hidden', 'true');
      this.clearContents(this.wrapper!);
      this.renderer.appendChild(this.wrapper!, icon);
    }
    this.operationMouseEnter.next(event);
  };

  onMouseOver = (event: MouseEvent) => {
    this.operationMouseOver.next(event);
  };

  onClick = (event: MouseEvent) => {
    if (this._operation?.state === 'ERROR') {
      this.onRepeatIconClick();
    }
  };

  unlisten(name: string) {
    if (this.listeners[name]) {
      for (const func of this.listeners[name]) {
        func();
      }
      delete this.listeners[name];
    }
  }
}
