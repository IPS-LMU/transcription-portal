import { Component, OnDestroy, ViewChild } from '@angular/core';
import {
  NgbActiveModal,
  NgbModalOptions,
  NgbModalRef,
} from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { ChartConfiguration } from 'chart.js';
import { NgCircleProgressModule } from 'ng-circle-progress';
import { NgChartsModule } from 'ng2-charts';
import { TaskService } from '../../obj/tasks/task.service';
import { StatisticsService } from '../../shared/statistics.service';

@Component({
  selector: 'tportal-statistics',
  templateUrl: './statistics-modal.component.html',
  styleUrls: ['./statistics-modal.component.scss'],
  standalone: true,
  imports: [NgCircleProgressModule, NgChartsModule],
})
export class StatisticsModalComponent
  extends SubscriberComponent
  implements OnDestroy
{
  @ViewChild('statisticsModal', { static: true }) statisticsModal?: NgbModalRef;
  public static options: NgbModalOptions = {
    size: 'xl',
    backdrop: true,
    fullscreen: 'sm',
  };

  // Pie
  public pieChartType: ChartConfiguration['type'] = 'pie';

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
    },
  };

  constructor(
    public statisticsService: StatisticsService,
    public taskService: TaskService,
    protected activeModal: NgbActiveModal
  ) {
    super();
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this.statisticsService.destroy();
  }
}
