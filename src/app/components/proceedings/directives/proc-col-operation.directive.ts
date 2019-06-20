import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  Renderer2,
  SimpleChanges
} from '@angular/core';
import {Task} from '../../../obj/tasks';
import {FileInfo} from '../../../obj/fileInfo';
import {Operation} from '../../../obj/operations/operation';
import {DomSanitizer} from '@angular/platform-browser';
import {TaskService} from '../../../obj/tasks/task.service';
import {SubscriptionManager} from '../../../shared/subscription-manager';
import {AppSettings} from '../../../shared/app.settings';

@Directive({
  selector: '[appProcColOperation]'
})
export class ProcColOperationDirective implements AfterViewInit, OnChanges, OnDestroy {

  @Input() entry: Task;
  @Input() operation: Operation;
  @Input() shortStyle = false;
  @Input() mouseOver = false;

  @Output() onAppendingClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();

  @Output() onOperationMouseEnter: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() onOperationMouseLeave: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() onOperationMouseOver: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  @Output() onDeleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor(private elementRef: ElementRef, private renderer: Renderer2,
              private sanitizer: DomSanitizer, private taskService: TaskService) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('shortStyle') && changes.shortStyle.currentValue !== undefined) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'max-width', (this.shortStyle) ? '150px' : 'auto');
    }
    this.updateView();
  }

  private updateView() {
    if (!(this.elementRef.nativeElement === null || this.elementRef.nativeElement === undefined)) {
      this.clearContents();

      if (this.entry && !(this.entry === null || this.entry === undefined)) {
        this.renderer.setStyle(this.elementRef.nativeElement, 'text-align', 'center');

        if (!(this.operation === null || this.operation === undefined)) {
          if (this.operation.state === 'FINISHED' && this.operation.results.length > 0 && !this.operation.lastResult.available) {
            // result is not available
            const icon = this.renderer.createElement('i');

            this.renderer.addClass(icon, 'fa');
            this.renderer.addClass(icon, 'fa-chain-broken');
            this.renderer.setAttribute(icon, 'aria-hidden', 'true');
            this.renderer.appendChild(this.elementRef.nativeElement, icon);
          } else {
            // result is available

            if (this.operation.enabled) {
              let icon = null;
              if (!(this.operation.mouseover && this.operation.state === 'ERROR')) {
                const wrapper = this.renderer.createElement('div');
                this.renderer.setStyle(wrapper, 'display', 'inline');
                wrapper.innerHTML = this.operation.getStateIcon2(this.operation.state);

                this.renderer.listen(wrapper, 'mouseover', this.onMouseOver);
                this.renderer.listen(wrapper, 'mouseenter', this.onMouseEnter);
                this.renderer.listen(wrapper, 'mouseleave', this.onMouseLeave);
                this.renderer.appendChild(this.elementRef.nativeElement, wrapper);
              } else {
                icon = this.renderer.createElement('i');
                this.renderer.addClass(icon, 'fa');
                this.renderer.addClass(icon, 'fa-repeat');
                this.renderer.setAttribute(icon, 'aria-hidden', 'true');
                this.renderer.appendChild(this.elementRef.nativeElement, icon);

                this.renderer.listen(icon, 'click', this.onRepeatIconClick);
              }

              this.renderer.removeClass(this.elementRef.nativeElement, 'op-deactivated');
            } else {
              // operation disabled
              this.renderer.addClass(this.elementRef.nativeElement, 'op-deactivated');

              const icon = this.renderer.createElement('i');
              this.renderer.addClass(icon, 'fa');
              this.renderer.addClass(icon, 'fa-arrow-circle-right');
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
    for (let i = 0; i < (<HTMLElement>this.elementRef.nativeElement).children.length; i++) {
      const child = this.elementRef.nativeElement.children[i];

      if (!(child === null || child === undefined)) {
        const old_length = this.elementRef.nativeElement.children.length;
        this.renderer.removeChild(this.elementRef.nativeElement, child);
        if (old_length > this.elementRef.nativeElement.children.length) {
          i--;
        }
      }
    }
  }

  private onMouseOver = (event) => {
    console.log(`MOUSEOVER PROCCOL`);
    this.onOperationMouseOver.next(event);
  }

  private onMouseEnter = (event) => {
    this.onOperationMouseEnter.next(event);
  }

  private onMouseLeave = (event) => {
    this.onOperationMouseLeave.next(event);
  }

  private onRepeatIconClick = () => {
    const langObj = AppSettings.getLanguageByCode(this.entry.language, this.entry.asr);
    this.entry.restartFailedOperation(langObj, this.taskService.httpclient);
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
        throw new Error('ProcOperationDirective error: entry of type Task does not have any files');
      }
    } else {
      throw new Error('ProcOperationDirective error: no entry set');
    }

    // listen to operation changes because these are not detected by default
    this.subscrmanager.add(this.operation.statechange.subscribe(() => {
      this.updateView();
    }));

    this.subscrmanager.add(this.operation.changed.subscribe(() => {
      this.updateView();
    }));
  }
}
