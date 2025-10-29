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
import { FileInfo } from '@octra/web-media';
import { Subscription } from 'rxjs';
import { Task, TaskDirectory, TaskStatus } from '../../../obj/tasks';
import { TPortalFileInfo } from '../../../obj/TPortalFileInfoAttributes';

@Directive({
  selector: '[tportalProcColIcon]',
  exportAs: 'colIcon',
  standalone: true,
})
export class ProcColIconDirective implements AfterViewInit, OnChanges, OnDestroy {
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);

  @Input() entry?: Task | TaskDirectory;
  @Input() shortStyle = false;
  @Input() mouseOver = false;

  @Output() appendingClick: EventEmitter<TPortalFileInfo> = new EventEmitter<TPortalFileInfo>();

  @Output() infoMouseEnter: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() infoMouseLeave: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() infoMouseOver: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() tagClicked: EventEmitter<'opened' | 'closed'> = new EventEmitter<'opened' | 'closed'>();

  @Output() deleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Input() public dirOpened: 'opened' | 'closed' = 'opened';
  private subscrmanager = new SubscriptionManager<Subscription>();

  ngOnChanges(changes: SimpleChanges) {
    if (hasProperty(changes, 'shortStyle') && changes['shortStyle'].currentValue !== undefined) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'max-width', this.shortStyle ? '150px' : 'inherit');
    }
    if (hasProperty(changes, 'entry') && changes['entry'].currentValue !== undefined) {
      // entry set

      // changes of entry must be observed specifically
      if (this.entry instanceof Task) {
        this.subscrmanager.removeByTag('update');
        this.subscrmanager.add(
          this.entry.statechange.subscribe(() => {
            this.updateView();
          }),
          'update',
        );

        this.subscrmanager.add(
          this.entry.fileschange.subscribe(() => {
            this.updateView();
          }),
          'update',
        );
      }
    }
    this.updateView();
  }

  ngAfterViewInit() {
    if (!this.entry) {
      throw new Error('ProcColDirective error: no entry set');
    }
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  afterTagClicked = () => {
    if (this.dirOpened === 'opened') {
      this.dirOpened = 'closed';
    } else {
      this.dirOpened = 'opened';
    }
    this.updateView();
    this.tagClicked.emit(this.dirOpened);
  };

  private updateView() {
    if (this.elementRef.nativeElement) {
      if (this.entry) {
        this.clearContents();
        const wrapper: HTMLElement = this.renderer.createElement('div');
        this.renderer.addClass(wrapper, 'd-flex');
        this.renderer.addClass(wrapper, 'align-items-center');
        this.renderer.removeClass(wrapper, 'shorten');
        if (this.shortStyle) {
          this.renderer.addClass(wrapper, 'shorten');
        }
        this.renderer.setAttribute(this.elementRef.nativeElement, 'colspan', '2');
        this.appendIcon(wrapper);
        this.appendFileNameSpan(wrapper);

        if (this.entry instanceof Task) {
          this.appendAppendingsSpan(wrapper);
          const infoIcon = this.renderer.createElement('i');
          const deleteIcon = this.renderer.createElement('i');

          this.renderer.addClass(infoIcon, 'bi');
          this.renderer.addClass(infoIcon, 'bi-info-circle');
          this.renderer.setAttribute(infoIcon, 'aria-hidden', 'true');
          this.renderer.addClass(deleteIcon, 'bi');
          this.renderer.addClass(deleteIcon, 'bi-dash-circle');
          this.renderer.setAttribute(deleteIcon, 'aria-hidden', 'true');

          if (this.mouseOver) {
            this.renderer.setStyle(infoIcon, 'visibility', 'visible');
            this.renderer.setStyle(deleteIcon, 'visibility', 'visible');
          } else {
            this.renderer.setStyle(infoIcon, 'visibility', 'hidden');
            this.renderer.setStyle(deleteIcon, 'visibility', 'hidden');
          }

          this.renderer.listen(infoIcon, 'mouseenter', (event) => {
            this.infoMouseEnter.emit(event);
          });
          this.renderer.listen(infoIcon, 'mouseleave', (event) => {
            this.infoMouseLeave.emit(event);
          });
          this.renderer.listen(infoIcon, 'mouseover', (event) => {
            this.infoMouseOver.emit(event);
          });

          this.renderer.listen(deleteIcon, 'click', (event) => {
            this.deleteIconClick.emit(event);
          });

          this.renderer.appendChild(wrapper, infoIcon);
          this.renderer.appendChild(wrapper, deleteIcon);
        }
        this.renderer.appendChild(this.elementRef.nativeElement, wrapper);
      }
    } else {
      throw new Error('ProcColDirective error: updateView: nativeElement is undefined');
    }
  }

  private appendIcon(wrapper: HTMLElement) {
    let icon: HTMLElement;
    if (this.entry instanceof Task) {
      if (this.entry.directory === null || this.entry.directory === undefined) {
        // normal line
        icon = this.renderer.createElement('i');
        this.renderer.addClass(icon, 'me-1');
        this.renderer.addClass(icon, 'bi');
        this.renderer.addClass(icon, 'bi-file-earmark-music');
        this.renderer.setAttribute(icon, 'aria-hidden', 'true');

        switch (this.entry.status) {
          case TaskStatus.FINISHED:
            this.renderer.addClass(icon, 'green');
            break;
          case TaskStatus.ERROR:
            this.renderer.addClass(icon, 'red');
            break;
          case TaskStatus.PENDING || this.entry.status === TaskStatus.READY:
            this.renderer.addClass(icon, 'blue');
            break;
          case TaskStatus.PROCESSING:
            this.renderer.addClass(icon, 'yellow');
            break;
        }

        this.renderer.appendChild(wrapper, icon);
      } else {
        // task is part of a folder

        const img = this.renderer.createElement('img');
        this.renderer.setAttribute(img, 'src', 'assets/directory.png');
        this.renderer.setStyle(img, 'width', '20px');
        this.renderer.setStyle(img, 'margin-right', '3px');
        this.renderer.appendChild(wrapper, img);

        icon = this.renderer.createElement('i');
        this.renderer.addClass(icon, 'me-1');
        this.renderer.addClass(icon, 'bi');
        this.renderer.addClass(icon, 'bi-file-earmark-music');
        this.renderer.setAttribute(icon, 'aria-hidden', 'true');

        switch (this.entry.status) {
          case TaskStatus.FINISHED:
            this.renderer.addClass(icon, 'green');
            break;
          case TaskStatus.ERROR:
            this.renderer.addClass(icon, 'red');
            break;
          case TaskStatus.PENDING || TaskStatus.READY:
            this.renderer.addClass(icon, 'blue');
            break;
          case TaskStatus.PROCESSING:
            this.renderer.addClass(icon, 'yellow');
            break;
        }

        this.renderer.appendChild(wrapper, icon);
      }
    } else {
      // TaskDirectory

      const tag = this.renderer.createElement('span');
      this.renderer.addClass(tag, 'bi');

      if (this.dirOpened === 'opened') {
        this.renderer.addClass(tag, 'bi-chevron-up');
      } else {
        this.renderer.addClass(tag, 'bi-chevron-down');
      }
      this.renderer.appendChild(wrapper, tag);
      this.renderer.listen(tag, 'click', this.afterTagClicked);

      icon = this.renderer.createElement('i');
      this.renderer.addClass(icon, 'me-1');
      this.renderer.addClass(icon, 'bi');

      if (this.dirOpened === 'opened') {
        this.renderer.addClass(icon, 'bi-folder2-open');
      } else {
        this.renderer.addClass(icon, 'bi-folder-fill');
      }
      this.renderer.addClass(icon, 'blue');

      this.renderer.appendChild(wrapper, icon);
    }
  }

  private appendFileNameSpan(wrapper: HTMLElement) {
    const result: HTMLElement = this.renderer.createElement('span');
    this.renderer.addClass(result, 'text-truncate');

    this.renderer.removeClass(this.elementRef.nativeElement, 'shorten');
    if (this.shortStyle) {
      this.renderer.addClass(this.elementRef.nativeElement, 'shorten');
    }

    if (this.entry instanceof Task) {
      if (this.entry.files[0].extension === '.wav' && this.entry.files[0].file !== undefined) {
        this.renderer.addClass(result, 'green');
      } else if (
        ((this.entry.files[0].extension === '.wav' && this.entry.files[0].file === undefined) || this.entry.files[0].extension !== '.wav') &&
        this.entry.operations[0].state !== 'FINISHED'
      ) {
        this.renderer.addClass(result, 'yellow');
      }

      // set filename
      this.renderer.setAttribute(result, 'title', this.entry.files[0].attributes?.originalFileName);
      const filename = this.renderer.createText(' ' + this.entry.files[0].attributes?.originalFileName.replace('_annot.json', '.wav') + ' ');
      this.renderer.appendChild(result, filename);
      this.renderer.appendChild(wrapper, result);
    } else {
      // TaskDirectory

      // this.renderer.setAttribute(this.elementRef.nativeElement, 'colspan', '' + (this.taskService.operations.length + 1));

      // set filename
      if (this.entry) {
        this.renderer.setAttribute(result, 'title', this.entry.foldername);
        const filename = this.renderer.createText(' ' + this.entry.foldername);
        this.renderer.appendChild(result, filename);

        if (this.entry.entries.length > 0) {
          // set number of files
          const filesNumSpan = this.renderer.createElement('span');
          const filesNum = this.renderer.createText(' (' + this.entry.entries.length + ')');
          this.renderer.appendChild(filesNumSpan, filesNum);
          this.renderer.appendChild(result, filesNumSpan);
        }
      }
      this.renderer.appendChild(wrapper, result);
    }
  }

  private appendAppendingsSpan(wrapper: HTMLElement) {
    const result: HTMLElement = this.renderer.createElement('span');

    if (this.entry instanceof Task) {
      if (this.entry.files.length > 1 || this.entry.files[0].extension !== '.wav') {
        const badgeObj = this.getBadge(this.entry);
        this.renderer.addClass(result, 'ms-1');
        this.renderer.addClass(result, 'px-2');
        this.renderer.addClass(result, 'pill');
        this.renderer.addClass(result, 'rounded');
        this.renderer.addClass(result, 'bg-' + badgeObj.type);
        this.renderer.addClass(result, 'text-light');
        this.renderer.setStyle(result, 'font-size', '0.85rem');
        this.renderer.listen(result, 'click', () => {
          const files = (this.entry as Task).files;
          this.appendingClick.emit(files[1] as TPortalFileInfo);
        });
        const content = this.renderer.createText(badgeObj.label);
        this.renderer.appendChild(result, content);
        this.renderer.appendChild(wrapper, result);
      }
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

  private getBadge(task: Task): {
    type: string;
    label: string;
  } {
    if ((task.files.length > 1 && task.files[1].file !== undefined) || task.operations[0].rounds.length > 1 || task.files[0].extension !== '.wav') {
      return {
        type: 'info',
        label: task.files[0].extension !== '.wav' ? task.files[0].extension : task.files[1].extension,
      };
    } else {
      return {
        type: 'warning',
        label: task.files[0].extension !== '.wav' ? task.files[0].extension : task.files[1].extension,
      };
    }
  }
}
