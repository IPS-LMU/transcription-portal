import { Component, HostListener, Input, OnChanges, SimpleChanges } from '@angular/core';
import { Operation } from '../../../obj/operations/operation';
import { Task } from '../../../obj/tasks';
import { OperationColDefaultIconComponent } from './operation-col-default-icon/operation-col-default-icon.component';
import { OperationColToolComponent } from './operation-col-tool/operation-col-tool.component';
import { OperationColUploadComponent } from './operation-col-upload/operation-col-upload.component';

@Component({
  selector: 'tportal-operation-col-selector',
  templateUrl: './operation-col-selector.component.html',
  styleUrls: ['./operation-col-selector.component.scss'],
  imports: [OperationColUploadComponent, OperationColToolComponent, OperationColDefaultIconComponent],
})
export class OperationColSelectorComponent implements OnChanges {
  @Input() operation?: Operation;
  @Input() task?: Task;

  protected mouseIn = false;

  ngOnChanges(changes: SimpleChanges) {}

  @HostListener('mouseover', ['$event'])
  mouseOver(event: MouseEvent) {
    this.mouseIn = true;
    this.operation?.onMouseOver();
  }

  @HostListener('mouseenter', ['$event'])
  onMouseEnter(event: MouseEvent) {
    this.mouseIn = true;
    this.operation?.onMouseEnter();
  }

  @HostListener('mouseleave', ['$event'])
  onMouseLeave(event: MouseEvent) {
    this.mouseIn = false;
    this.operation?.onMouseLeave();
  }
}
