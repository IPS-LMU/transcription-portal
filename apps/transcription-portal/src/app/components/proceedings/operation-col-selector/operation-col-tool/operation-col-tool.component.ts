import { ChangeDetectorRef, Component, inject, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ToolOperation } from '../../../../obj/operations/tool-operation';
import { OperationColBaseComponent } from '../operation-col-base/operation-col-base.component';
import { OperationColDefaultIconComponent } from '../operation-col-default-icon/operation-col-default-icon.component';

@Component({
  selector: 'tportal-operation-col-tool',
  templateUrl: './operation-col-tool.component.html',
  styleUrls: ['./operation-col-tool.component.scss'],
  imports: [OperationColDefaultIconComponent],
})
export class OperationColToolComponent extends OperationColBaseComponent implements OnChanges, OnInit {
  private cd = inject(ChangeDetectorRef);

  get toolOperation(): ToolOperation | undefined {
    return this.operation as ToolOperation;
  }

  override ngOnChanges(changes: SimpleChanges) {
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  ngOnInit() {}
}
