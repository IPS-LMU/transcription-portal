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
import {Task, TaskDirectory, TaskState} from '../../../obj/tasks';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../../../obj/fileInfo';
import {TaskService} from '../../../obj/tasks/task.service';
import {SubscriptionManager} from '../../../shared/subscription-manager';

@Directive({
  selector: '[appProcColIcon]',
  exportAs: 'colIcon'
})
export class ProcColIconDirective implements AfterViewInit, OnChanges, OnDestroy {

  @Input('entry') entry: (Task | TaskDirectory);
  @Input('shortStyle') shortStyle = false;
  @Input('mouseover') mouseOver = false;

  @Output('onAppendingClick') onAppendingClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();

  @Output('onInfoMouseEnter') onInfoMouseEnter: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output('onInfoMouseLeave') onInfoMouseLeave: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output('onInfoMouseOver') onInfoMouseOver: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output('onTagClicked') onTagClicked: EventEmitter<'opened' | 'closed'> = new EventEmitter<'opened' | 'closed'>();

  @Output('onDeleteIconClick') onDeleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  @Input() public dirOpened: 'opened' | 'closed' = 'opened';

  constructor(private elementRef: ElementRef, private renderer: Renderer2, private taskService: TaskService) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('shortStyle') && changes.shortStyle.currentValue !== undefined) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'max-width', (this.shortStyle) ? '150px' : 'auto');
    }
    this.updateView();
  }

  private updateView() {
    if (!isNullOrUndefined(this.elementRef.nativeElement)) {

      if (!isNullOrUndefined(this.entry)) {
        this.clearContents();
        const wrapper: HTMLElement = this.renderer.createElement('div');
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

          this.renderer.addClass(infoIcon, 'fa');
          this.renderer.addClass(infoIcon, 'fa-info-circle');
          this.renderer.setAttribute(infoIcon, 'aria-hidden', 'true');
          this.renderer.addClass(deleteIcon, 'fa');
          this.renderer.addClass(deleteIcon, 'fa-minus-circle');
          this.renderer.setAttribute(deleteIcon, 'aria-hidden', 'true');

          if (this.mouseOver) {
            this.renderer.setStyle(infoIcon, 'visibility', 'visible');
            this.renderer.setStyle(deleteIcon, 'visibility', 'visible');
          } else {
            this.renderer.setStyle(infoIcon, 'visibility', 'hidden');
            this.renderer.setStyle(deleteIcon, 'visibility', 'hidden');
          }

          this.renderer.listen(infoIcon, 'mouseenter', (event) => {
            this.onInfoMouseEnter.emit(event);
          });
          this.renderer.listen(infoIcon, 'mouseleave', (event) => {
            this.onInfoMouseLeave.emit(event);
          });
          this.renderer.listen(infoIcon, 'mouseover', (event) => {
            this.onInfoMouseOver.emit(event);
          });

          this.renderer.listen(deleteIcon, 'click', (event) => {
            this.onDeleteIconClick.emit(event);
          });

          this.renderer.appendChild(wrapper, infoIcon);
          this.renderer.appendChild(wrapper, deleteIcon);
        }
        this.renderer.appendChild(this.elementRef.nativeElement, wrapper);
      }
    } else {
      throw 'ProcColDirective error: updateView: nativeElement is undefined';
    }
  }

  private appendIcon(wrapper: HTMLElement) {
    let icon: HTMLElement;
    if (this.entry instanceof Task) {
      if (this.entry.directory === null || this.entry.directory === undefined) {
        // normal line
        icon = this.renderer.createElement('i');
        this.renderer.addClass(icon, 'fa');
        this.renderer.addClass(icon, 'fa-file-audio-o');
        this.renderer.setAttribute(icon, 'aria-hidden', 'true');

        switch (this.entry.state) {
          case(TaskState.FINISHED):
            this.renderer.addClass(icon, 'green');
            break;
          case(TaskState.ERROR):
            this.renderer.addClass(icon, 'red');
            break;
          case(TaskState.PENDING || this.entry.state === TaskState.READY):
            this.renderer.addClass(icon, 'blue');
            break;
          case(TaskState.PROCESSING):
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

        const icon = this.renderer.createElement('i');
        this.renderer.addClass(icon, 'fa');
        this.renderer.addClass(icon, 'fa-file-audio-o');
        this.renderer.setAttribute(icon, 'aria-hidden', 'true');

        switch (this.entry.state) {
          case(TaskState.FINISHED):
            this.renderer.addClass(icon, 'green');
            break;
          case(TaskState.ERROR):
            this.renderer.addClass(icon, 'red');
            break;
          case(TaskState.PENDING || TaskState.READY):
            this.renderer.addClass(icon, 'blue');
            break;
          case(TaskState.PROCESSING):
            this.renderer.addClass(icon, 'yellow');
            break;
        }

        this.renderer.appendChild(wrapper, icon);
      }
    } else {
      // TaskDirectory

      const tag = this.renderer.createElement('span');
      this.renderer.addClass(tag, 'fa');

      if (this.dirOpened === 'opened') {
        this.renderer.addClass(tag, 'fa-angle-up');
      } else {
        this.renderer.addClass(tag, 'fa-angle-down');
      }
      this.renderer.appendChild(wrapper, tag);
      this.renderer.listen(tag, 'click', this.tagClicked);

      icon = this.renderer.createElement('i');
      this.renderer.addClass(icon, 'fa');

      if (this.dirOpened === 'opened') {
        this.renderer.addClass(icon, 'fa-folder-open');
      } else {
        this.renderer.addClass(icon, 'fa-folder');
      }
      this.renderer.addClass(icon, 'blue');

      this.renderer.appendChild(wrapper, icon);
    }
  }

  private appendFileNameSpan(wrapper) {
    let result: HTMLElement = this.renderer.createElement('span');

    if (this.shortStyle) {
      this.renderer.addClass(this.elementRef.nativeElement, 'shorten');
    }

    if (this.entry instanceof Task) {
      if (this.entry.files[0].extension === '.wav' && this.entry.files[0].file !== undefined) {
        this.renderer.addClass(result, 'green');
      } else if (
        (
          (this.entry.files[0].extension === '.wav' && this.entry.files[0].file === undefined)
          || this.entry.files[0].extension !== '.wav'
        )
        && this.entry.operations[0].state !== 'FINISHED') {
        this.renderer.addClass(result, 'yellow');
      }

      // set filename
      this.renderer.setAttribute(result, 'title', this.entry.files[0].attributes.originalFileName);
      const filename = this.renderer.createText(' ' + this.entry.files[0].name.replace('_annot', '') + '.wav ');
      this.renderer.appendChild(result, filename);
      this.renderer.appendChild(wrapper, result);
    } else {
      // TaskDirectory

      //this.renderer.setAttribute(this.elementRef.nativeElement, 'colspan', '' + (this.taskService.operations.length + 1));

      // set filename
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
      this.renderer.appendChild(wrapper, result);
    }
  }

  private appendAppendingsSpan(wrapper) {
    const result: HTMLElement = this.renderer.createElement('span');

    if (this.entry instanceof Task) {
      if (this.entry.files.length > 1 || this.entry.files[0].extension !== '.wav') {
        const badgeObj = this.getBadge(this.entry);
        this.renderer.addClass(result, 'badge');
        this.renderer.addClass(result, 'badge-' + badgeObj.type);
        this.renderer.listen(result, 'click', () => {
          const files = (<Task> this.entry).files;
          console.log(`entries ${files.length}`);
          this.onAppendingClick.emit(files[1]);
        });
        const content = this.renderer.createText(badgeObj.label);
        this.renderer.appendChild(result, content);
        this.renderer.appendChild(wrapper, result);
      }
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

  private getBadge(task: Task): {
    type: string,
    label: string
  } {
    if ((task.files.length > 1 && task.files[1].file !== undefined || task.operations[0].results.length > 1)
      || (task.files[0].extension !== '.wav')
    ) {
      return {
        type: 'info',
        label: (task.files[0].extension !== '.wav') ? task.files[0].extension : task.files[1].extension
      };
    } else {
      return {
        type: 'warning',
        label: (task.files[0].extension !== '.wav') ? task.files[0].extension : task.files[1].extension
      }
    }
  }

  ngAfterViewInit() {
    if (!isNullOrUndefined(this.entry)) {
      // entry set
      if (this.entry instanceof Task) {
        if (!isNullOrUndefined(this.entry.files)) {
          this.updateView();
        } else {
          throw 'ProcColDirective error: entry of type Task does not have any files';
        }
      }

      // changes of entry must be observed specifically
      if (this.entry instanceof Task) {
        this.subscrmanager.add(this.entry.statechange.subscribe(() => {
          this.updateView();
        }));

        this.subscrmanager.add(this.entry.fileschange.subscribe(() => {
          console.log(`FILES CHANGE!`);
          this.updateView();
        }));
      }
    } else {
      throw 'ProcColDirective error: no entry set';
    }
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  tagClicked = () => {
    if (this.dirOpened === 'opened') {
      this.dirOpened = 'closed';
    } else {
      this.dirOpened = 'opened';
    }
    this.updateView();
    this.onTagClicked.emit(this.dirOpened);
  }
}
