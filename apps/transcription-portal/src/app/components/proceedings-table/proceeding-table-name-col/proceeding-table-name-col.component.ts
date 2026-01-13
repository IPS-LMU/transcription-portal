import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, inject, Input, OnChanges, Output, Renderer2, SimpleChanges } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
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

  @HostListener('mouseover', ['$event'])
  protected onMouseOver($event: MouseEvent) {
    this.mouseOver = true;
  }

  @HostListener('mouseleave', ['$event'])
  protected onMouseLeave($event: MouseEvent) {
    this.mouseOver = false;
  }

  @HostListener('blur', ['$event'])
  protected onBlur($event: MouseEvent) {
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

  protected readonly TaskStatus = TaskStatus;
  protected readonly getLastOperationRound = getLastOperationRound;
}
