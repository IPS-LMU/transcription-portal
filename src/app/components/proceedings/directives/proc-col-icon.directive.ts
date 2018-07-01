import {
  AfterViewInit,
  Directive,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  Renderer2,
  SimpleChanges
} from '@angular/core';
import {Task, TaskDirectory, TaskState} from '../../../obj/tasks';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../../../obj/fileInfo';

@Directive({
  selector: '[appProcColIcon]'
})
export class ProcColIconDirective implements AfterViewInit, OnChanges {

  @Input('entry') entry: (Task | TaskDirectory);
  @Input('shortStyle') shortStyle = false;
  @Input('mouseover') mouseOver = false;

  @Output('onAppendingClick') onAppendingClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();

  @Output('onInfoMouseEnter') onInfoMouseEnter: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output('onInfoMouseLeave') onInfoMouseLeave: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output('onInfoMouseOver') onInfoMouseOver: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  @Output('onDeleteIconClick') onDeleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  constructor(private elementRef: ElementRef, private renderer: Renderer2) {
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log(changes);

    if (changes.hasOwnProperty('shortStyle') && changes.shortStyle.currentValue !== undefined) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'max-width', (this.shortStyle) ? '150px' : 'auto');
    }
    this.updateView();
  }

  private updateView() {
    if (!isNullOrUndefined(this.elementRef.nativeElement)) {
      this.clearContents();
      const wrapper: HTMLElement = this.renderer.createElement('div');
      if (this.shortStyle) {
        this.renderer.addClass(wrapper, 'shorten');
      }
      const icon = this.createIcon();
      const filenameSpan = this.createFileNameSpan();
      const appendingSpan = this.createAppendingsSpan();

      /*
      <i *ngIf="entry.mouseover" class="fa fa-info-circle" aria-hidden="true"
                               (mouseenter)="onInfoMouseEnter($event, entry, td)"
                               (mouseleave)="onInfoMouseLeave($event, entry)"
                               (mouseover)="onInfoMouseOver($event, entry)"
                            ></i>

                            <i *ngIf="entry.mouseover" class="fa fa-minus-circle" aria-hidden="true"
                               (click)="removeEntry($event, entry)"
                            ></i>
       */

      this.renderer.appendChild(wrapper, icon);
      this.renderer.appendChild(wrapper, filenameSpan);
      this.renderer.appendChild(wrapper, appendingSpan);

      if (this.entry instanceof Task) {
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
    } else {
      throw 'ProcColDirective error: updateView: nativeElement is undefined';
    }
  }

  private createIcon(): HTMLElement {
    let icon: HTMLElement;
    if (this.entry instanceof Task) {
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
    } else {
      // TaskDirectory
    }

    return icon;
  }

  private createFileNameSpan(): HTMLElement {
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
    } else {
      // TaskDirectory
    }

    return result;
  }

  private createAppendingsSpan(): HTMLElement {
    const result: HTMLElement = this.renderer.createElement('span');

    if (this.entry instanceof Task) {
      if (this.entry.files.length > 1 || this.entry.files[0].extension !== '.wav') {
        const badgeObj = this.getBadge(this.entry);
        this.renderer.addClass(result, 'badge');
        this.renderer.addClass(result, 'badge-' + badgeObj.type);
        this.renderer.listen(result, 'click', () => {
          const files = (<Task> this.entry).files;
          console.log(`entries ${files.length}`);
          console.log(files[1]);
          this.onAppendingClick.emit(files[1]);
        });
        const content = this.renderer.createText(badgeObj.label);
        this.renderer.appendChild(result, content);
      }
    } else {
      return null;
    }

    return result;
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

  /*
                            </ng-container>

  <div [ngClass]="{
                            'shorten': shortstyle
                        }">
                            <ng-container>
                                <i class="fa fa-file-audio-o"
                                   aria-hidden="true"
                                   [ngClass]="{
                                        green: (entry.state === 'FINISHED'),
                                        red: (entry.state === 'ERROR'),
                                        blue: (entry.state === 'PENDING' || entry.state === 'READY'),
                                        yellow: (entry.state === 'PROCESSING')
                                    }">
                                </i>
                            </ng-container>
                            <span [ngClass]="{
                                'shorten': shortstyle,
                                'green': ((entry.files[0].extension === '.wav' && entry.files[0].file !== undefined)),
                                'yellow': ((entry.files[0].extension === '.wav' && entry.files[0].file === undefined) || entry.files[0].extension !== '.wav') && entry.operations[0].state !== 'FINISHED'
                                }" title="{{entry.files[0].attributes.originalFileName}}">
                                {{entry.files[0].name.replace('_annot', '') + '.wav'}}
                            </span>
                            <ng-container *ngIf=" entry.files.length > 1 || entry.files[0].extension !== '.wav'">
                                <span class="badge" [ngClass]="{
                                    'badge-info': getBadge(entry).type === 'info',
                                    'badge-warning': getBadge(entry).type === 'warning'
                                }" (click)="onPreviewClick(entry.files[1])">
                                    {{getBadge(entry).label}}
                                </span>
                            </ng-container>
                            <i *ngIf="entry.mouseover" class="fa fa-info-circle" aria-hidden="true"
                               (mouseenter)="onInfoMouseEnter($event, entry, td)"
                               (mouseleave)="onInfoMouseLeave($event, entry)"
                               (mouseover)="onInfoMouseOver($event, entry)"
                            ></i>

                            <i *ngIf="entry.mouseover" class="fa fa-minus-circle" aria-hidden="true"
                               (click)="removeEntry($event, entry)"
                            ></i>
                        </div>
   */
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

    } else {
      throw 'ProcColDirective error: no entry set';
    }
  }
}
