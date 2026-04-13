import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnChanges, Output, Renderer2, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { FileInfo } from '@octra/web-media';
import { TPortalFileInfo } from '../../../obj/TPortalFileInfoAttributes';
import { StoreItem, TaskStatus } from '../../../store';
import { getLastOperationRound } from '../../../store/operation/operation.functions';

@Component({
  selector: 'tportal-proceeding-table-name-col',
  templateUrl: './proceeding-table-name-col.component.html',
  styleUrls: ['./proceeding-table-name-col.component.scss'],
  imports: [NgClass, NgTemplateOutlet],
})
export class ProceedingTableNameColComponent extends SubscriberComponent implements OnChanges {
  protected elementRef = inject(ElementRef);
  protected renderer = inject(Renderer2);

  @Input() entry?: StoreItem;
  @Input() public dirOpened: 'opened' | 'closed' = 'closed';
  @Input() shortStyle = false;

  @Output() appendingClick: EventEmitter<TPortalFileInfo> = new EventEmitter<TPortalFileInfo>();
  @Output() infoMouseEnter: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() infoMouseLeave: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() infoMouseOver: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();
  @Output() tagClicked: EventEmitter<'opened' | 'closed'> = new EventEmitter<'opened' | 'closed'>();
  @Output() deleteIconClick: EventEmitter<MouseEvent> = new EventEmitter<MouseEvent>();

  mouseOver = false;

  constructor() {
    super();
  }

  @HostListener('mouseover')
  protected onMouseOver() {
    this.mouseOver = true;
  }

  @HostListener('mouseleave')
  protected onMouseLeave() {
    this.mouseOver = false;
  }

  @HostListener('blur')
  protected onBlur() {
    this.mouseOver = false;
  }

  ngOnChanges(changes: SimpleChanges) {}

  afterTagClicked = () => {
    if (this.dirOpened === 'opened') {
      this.dirOpened = 'closed';
    } else {
      this.dirOpened = 'opened';
    }
    this.tagClicked.emit(this.dirOpened);
  };

  get cleanedUpFirstFileName() {
    if (this.entry?.files && this.entry.files.length > 0) {
      const { name } = FileInfo.extractFileName(this.entry.files[0].attributes.originalFileName);
      return name;
    }
    return '<NO NAME>';
  }

  get cleanedUpFirstFileExtension() {
    const secondFile = this.entry?.files?.find((a) => !a.type.includes('audio'));

    if (secondFile) {
      const { extension } = FileInfo.extractFileName(secondFile.attributes.originalFileName);
      return extension;
    }
    return '';
  }

  get appending() {
    if (this.entry?.files && this.entry.files.length > 0) {
      const appending = this.entry.files.length > 1 ? this.entry.files[1] : this.entry.files[0];
      return appending;
    }
    return undefined;
  }

  protected readonly TaskStatus = TaskStatus;
  protected readonly getLastOperationRound = getLastOperationRound;
}
