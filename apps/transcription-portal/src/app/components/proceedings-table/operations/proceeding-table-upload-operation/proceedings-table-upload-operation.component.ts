import { Component, Input, SimpleChanges } from '@angular/core';
import { TimePipe } from '../../../../shared/time.pipe';
import { OperationFactory, TaskStatus } from '../../../../store';
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

  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}

  protected readonly TaskStatus = TaskStatus;
  protected progress = 0;

  get time() {
    return this.storeTaskOperation?.estimatedEnd ? this.storeTaskOperation?.estimatedEnd - Date.now() : 0;
  }

  get lastOperationRound() {
    return this.storeTaskOperation ? getLastOperationRound(this.storeTaskOperation) : undefined;
  }

  public updateEstimatedEnd = () => {
    const lastRound = this.storeTaskOperation ? getLastOperationRound(this.storeTaskOperation) : undefined;

    if (this.progress > 0 && lastRound?.time) {
      const timeTillNow = Date.now() - lastRound?.time.start;
      const timeOnePercent = timeTillNow / this.progress;
      const time = Math.round((1 - this.progress) * timeOnePercent);
      // this.estimatedEnd = Date.now() + time;
    } else {
      // this.estimatedEnd = 0;
    }
  };
}
