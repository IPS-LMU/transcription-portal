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
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../../../obj/fileInfo';
import {Operation} from '../../../obj/tasks/operation';
import {DomSanitizer} from '@angular/platform-browser';
import {TaskService} from '../../../obj/tasks/task.service';
import {SubscriptionManager} from '../../../shared/subscription-manager';

@Directive({
  selector: '[appProcColOperation]'
})
export class ProcColOperationDirective implements AfterViewInit, OnChanges, OnDestroy {

  @Input('entry') entry: Task;
  @Input('operation') operation: Operation;
  @Input('shortStyle') shortStyle = false;
  @Input('mouseover') mouseOver = false;

  @Output('onAppendingClick') onAppendingClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();

  @Output('onOperationMouseEnter') onOperationMouseEnter: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output('onOperationMouseLeave') onOperationMouseLeave: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output('onOperationMouseOver') onOperationMouseOver: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  @Output('onDeleteIconClick') onDeleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

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
    if (!isNullOrUndefined(this.elementRef.nativeElement)) {
      this.clearContents();

      if (this.entry instanceof Task && !isNullOrUndefined(this.entry)) {
        this.renderer.setStyle(this.elementRef.nativeElement, 'text-align', 'center');

        if (!isNullOrUndefined(this.operation)) {
          console.log(`UPDATE VIEW ${this.operation.name} = ${this.operation.state}`);
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
              if (!(this.operation.mouseover && this.operation.state === 'ERROR')) {
                const icon = this.operation.getStateIcon2(this.operation.state);
                this.elementRef.nativeElement.innerHTML = icon;
              } else {
                const icon = this.renderer.createElement('i');
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
    for (let i = 0; i < (<HTMLElement> this.elementRef.nativeElement).children.length; i++) {
      const child = this.elementRef.nativeElement.children[i];

      if (!isNullOrUndefined(child)) {
        const old_length = this.elementRef.nativeElement.children.length;
        this.renderer.removeChild(this.elementRef.nativeElement, child);
        if (old_length > this.elementRef.nativeElement.children.length) {
          i--;
        }
      }
    }
  }

  private onRepeatIconClick = () => {
    this.entry.restartFailedOperation(this.taskService.httpclient);
  };


  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  ngAfterViewInit() {
    if (!isNullOrUndefined(this.entry)) {
      // entry set
      if (this.entry instanceof Task) {
        if (!isNullOrUndefined(this.entry.files)) {
          this.updateView();
        } else {
          throw new Error('ProcOperationDirective error: entry of type Task does not have any files');
        }
      }

    } else {
      throw new Error('ProcOperationDirective error: no entry set');
    }

    // listen to operation changes because these are not detected by default
    this.subscrmanager.add(this.operation.statechange.subscribe(() => {
      this.updateView();
    }));

    this.subscrmanager.add(this.operation.changed.subscribe(() => {
      console.log(`CHANGED CALLED!`);
      this.updateView();
    }));
  }
}
