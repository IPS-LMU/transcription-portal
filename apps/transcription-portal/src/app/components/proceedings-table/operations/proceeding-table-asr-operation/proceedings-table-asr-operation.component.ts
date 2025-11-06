import { Component, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';
import {
    ProceedingsTableOpIconComponent
} from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';

@Component({
  selector: 'tportal-proceedings-table-asr-operation',
  templateUrl: './proceedings-table-asr-operation.component.html',
  styleUrls: ['./proceedings-table-asr-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent],
})
export class ProceedingsTableAsrOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
