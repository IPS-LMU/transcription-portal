import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { interval } from 'rxjs';
import { UploadOperation } from '../../../../obj/operations/upload-operation';
import { TaskStatus } from '../../../../obj/tasks';
import { TimePipe } from '../../../../shared/time.pipe';
import { OperationColBaseComponent } from '../operation-col-base/operation-col-base.component';
import { OperationColDefaultIconComponent } from '../operation-col-default-icon/operation-col-default-icon.component';

@Component({
  selector: 'tportal-operation-col-upload',
  templateUrl: './operation-col-upload.component.html',
  styleUrls: ['./operation-col-upload.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TimePipe, OperationColDefaultIconComponent],
})
export class OperationColUploadComponent extends OperationColBaseComponent implements OnChanges, OnInit {
  private cd = inject(ChangeDetectorRef);
  protected estimatedEnd = 0;
  protected eta = 0;

  get uploadOperation(): UploadOperation | undefined {
    return this.operation as UploadOperation;
  }

  override ngOnChanges(changes: SimpleChanges) {
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  ngOnInit() {
    this.subscribe(interval(500), {
      next: () => {
        if (this.operation?.state === TaskStatus.UPLOADING) {
          this.updateEstimatedEnd();
          this.cd.markForCheck();
          this.cd.detectChanges();
        }
      },
    });
  }

  public updateEstimatedEnd = () => {
    if (this.uploadOperation && this.uploadOperation.progress > 0 && this.uploadOperation.lastRound?.time) {
      const timeTillNow = Date.now() - this.uploadOperation.lastRound.time.start;
      const timeOnePercent = timeTillNow / this.uploadOperation.progress;
      const time = Math.round((1 - this.uploadOperation.progress) * timeOnePercent);
      this.estimatedEnd = Date.now() + time;
    } else {
      this.estimatedEnd = 0;
    }
    this.eta = this.estimatedEnd ? this.estimatedEnd - Date.now() : 0;
  };
}
