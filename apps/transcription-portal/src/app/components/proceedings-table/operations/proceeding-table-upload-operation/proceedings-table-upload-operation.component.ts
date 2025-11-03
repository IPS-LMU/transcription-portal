import { Component, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';

@Component({
  selector: 'tportal-proceedings-table-upload-operation',
  templateUrl: './proceedings-table-upload-operation.component.html',
  styleUrls: ['./proceedings-table-upload-operation.component.scss'],
})
export class ProceedingsTableUploadOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
