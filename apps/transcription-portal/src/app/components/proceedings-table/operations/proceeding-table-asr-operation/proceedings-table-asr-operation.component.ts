import { Component, Input, SimpleChanges, ChangeDetectionStrategy } from '@angular/core';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';
import {
    ProceedingsTableOpIconComponent
} from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';
import { OperationFactory } from '../../../../store';

@Component({
  selector: 'tportal-proceedings-table-asr-operation',
  templateUrl: './proceedings-table-asr-operation.component.html',
  styleUrls: ['./proceedings-table-asr-operation.component.scss'],
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [ProceedingsTableOpIconComponent],
})
export class ProceedingsTableAsrOperationComponent extends ProceedingsTableOperationComponent {
  @Input() factory?: OperationFactory;

  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}
}
