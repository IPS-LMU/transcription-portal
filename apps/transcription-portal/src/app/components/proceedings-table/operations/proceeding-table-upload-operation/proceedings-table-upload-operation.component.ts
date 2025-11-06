import { Component, SimpleChanges } from '@angular/core';
import { TimePipe } from '../../../../shared/time.pipe';
import { TaskStatus } from '../../../../store';
import { ProceedingsTableOpIconComponent } from '../proceeding-table-operation/proceeding-table-op-icon/proceedings-table-op-icon.component';
import { ProceedingsTableOperationComponent } from '../proceeding-table-operation/proceedings-table-operation.component';

@Component({
  selector: 'tportal-proceedings-table-upload-operation',
  templateUrl: './proceedings-table-upload-operation.component.html',
  styleUrls: ['./proceedings-table-upload-operation.component.scss'],
  imports: [ProceedingsTableOpIconComponent, TimePipe],
})
export class ProceedingsTableUploadOperationComponent extends ProceedingsTableOperationComponent {
  constructor() {
    super();
  }

  override ngOnChanges(changes: SimpleChanges) {}

  protected readonly TaskStatus = TaskStatus;
  protected progress = 0;

  get time() {
    return this.storeTaskOperation?.estimatedEnd ? this.storeTaskOperation?.estimatedEnd - Date.now() : 0;
  }

  public updateEstimatedEnd = () => {
    if (this.progress > 0 && this.storeTaskOperation?.lastRound?.time) {
      const timeTillNow = Date.now() - this.storeTaskOperation?.lastRound?.time.start;
      const timeOnePercent = timeTillNow / this.progress;
      const time = Math.round((1 - this.progress) * timeOnePercent);
      // this.estimatedEnd = Date.now() + time;
    } else {
      // this.estimatedEnd = 0;
    }
  };
}
