import { Component, Input, SimpleChanges } from '@angular/core';
import { TimePipe } from '../../../../shared/time.pipe';
import { OperationFactory, StoreTaskOperationProcessingRound, TaskStatus, UploadOperation } from '../../../../store';
import { getLastOperationRound } from '../../../../store/operation/operation.functions';
import { ProceedingsTableOpIconComponent } from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';

@Component({
  selector: 'tportal-proceedings-table-upload-operation',
  templateUrl: './proceedings-table-upload-operation.component.html',
  styleUrls: ['./proceedings-table-upload-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent, TimePipe],
})
export class ProceedingsTableUploadOperationComponent extends ProceedingsTableOperationComponent {
  @Input() factory?: OperationFactory;
  protected offlineResultsFound = false;

  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {
    const operation = changes['storeTaskOperation']?.currentValue;
    if (operation) {
      const uploadOperation = operation as UploadOperation;
      const lastRound = getLastOperationRound(uploadOperation);
      this.offlineResultsFound =
        lastRound === undefined ? false : lastRound.results.find((a) => a.type.includes('audio') && (!a.online || !a.url)) !== undefined;
    }
  }

  protected readonly TaskStatus = TaskStatus;

  get currentRound(): StoreTaskOperationProcessingRound | undefined {
    return this.storeTaskOperation ? getLastOperationRound(this.storeTaskOperation) : undefined;
  }
  get time() {
    const round = this.currentRound;
    return round?.estimatedEnd ? round.estimatedEnd - Date.now() : 0;
  }

  get lastOperationRound() {
    return this.storeTaskOperation ? getLastOperationRound(this.storeTaskOperation) : undefined;
  }
}
