import { Component, Input, SimpleChanges } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';
import {
    ProceedingsTableOpIconComponent
} from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';
import { OperationFactory } from '../../../../store';

@Component({
  selector: 'tportal-proceedings-table-word-alignment-operation',
  templateUrl: './proceedings-table-word-alignment-operation.component.html',
  styleUrls: ['./proceedings-table-word-alignment-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent],
})
export class ProceedingsTableWordAlignmentOperationComponent extends ProceedingsTableOperationComponent {
  @Input() factory?: OperationFactory;

  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
