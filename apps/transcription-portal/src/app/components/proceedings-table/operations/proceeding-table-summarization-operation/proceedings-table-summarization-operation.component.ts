import { Component, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';
import {
    ProceedingsTableOpIconComponent
} from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';

@Component({
  selector: 'tportal-proceedings-table-summarization-operation',
  templateUrl: './proceedings-table-summarization-operation.component.html',
  styleUrls: ['./proceedings-table-summarization-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent],
})
export class ProceedingsTableSummarizationOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
