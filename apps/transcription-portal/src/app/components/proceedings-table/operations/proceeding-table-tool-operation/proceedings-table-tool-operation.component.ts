import { Component, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';
import {ProceedingsTableOpIconComponent} from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';
import { TaskStatus } from '../../../../store';

@Component({
  selector: 'tportal-proceedings-table-tool-operation',
  templateUrl: './proceedings-table-tool-operation.component.html',
  styleUrls: ['./proceedings-table-tool-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent],
})
export class ProceedingsTableToolOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}

  protected readonly TaskStatus = TaskStatus;
}
