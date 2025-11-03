import { Component, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';

@Component({
  selector: 'tportal-proceedings-table-asr-operation',
  templateUrl: './proceedings-table-asr-operation.component.html',
  styleUrls: ['./proceedings-table-asr-operation.component.scss'],
})
export class ProceedingsTableAsrOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
