import { Component, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';

@Component({
  selector: 'tportal-proceedings-table-tool-operation',
  templateUrl: './proceedings-table-tool-operation.component.html',
  styleUrls: ['./proceedings-table-tool-operation.component.scss'],
})
export class ProceedingsTableToolOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
