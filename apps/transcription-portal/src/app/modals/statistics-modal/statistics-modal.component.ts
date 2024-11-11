import {Component, OnDestroy, ViewChild} from '@angular/core';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {StatisticsService} from '../../shared/statistics.service';
import {TaskService} from '../../obj/tasks/task.service';
import {ChartConfiguration} from 'chart.js';
import {ModalDirective} from 'ngx-bootstrap/modal';
import {NgCircleProgressModule} from 'ng-circle-progress';
import {NgChartsModule} from 'ng2-charts';

@Component({
    selector: 'tportal-statistics',
    templateUrl: './statistics-modal.component.html',
    styleUrls: ['./statistics-modal.component.css'],
    standalone: true,
    imports: [ModalDirective, NgCircleProgressModule, NgChartsModule]
})
export class StatisticsModalComponent implements OnDestroy {

  @ViewChild('statisticsModal', {static: true}) statisticsModal?: ModalDirective;
  // Pie
  public pieChartType: ChartConfiguration['type'] = 'pie';
  private _subscrmanager: SubscriptionManager = new SubscriptionManager();

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      }
    }
  };

  constructor(public statisticsService: StatisticsService, public taskService: TaskService) {
  }

  ngOnDestroy() {
    this._subscrmanager.destroy();
    this.statisticsService.destroy();
  }

  public open() {
    if (this.statisticsModal) {
      this.statisticsModal.show();
    }
  }
}
