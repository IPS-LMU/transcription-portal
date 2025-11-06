import { Component, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';
import {
    ProceedingsTableOpIconComponent
} from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';

@Component({
  selector: 'tportal-proceedings-table-word-alignment-operation',
  templateUrl: './proceedings-table-word-alignment-operation.component.html',
  styleUrls: ['./proceedings-table-word-alignment-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent],
})
export class ProceedingsTableWordAlignmentOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
