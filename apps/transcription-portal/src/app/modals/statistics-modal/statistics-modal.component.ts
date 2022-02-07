import {Component, OnDestroy, ViewChild} from '@angular/core';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {StatisticsService} from '../../shared/statistics.service';
import {TaskService} from '../../obj/tasks/task.service';
import {ChartType} from 'chart.js';
import {ModalDirective} from 'ngx-bootstrap/modal';

@Component({
  selector: 'tportal-statistics',
  templateUrl: './statistics-modal.component.html',
  styleUrls: ['./statistics-modal.component.css']
})
export class StatisticsModalComponent implements OnDestroy {

  @ViewChild('statisticsModal', {static: true}) statisticsModal?: ModalDirective;
  // Pie
  public pieChartType: ChartType = 'pie';
  private _subscrmanager: SubscriptionManager = new SubscriptionManager();

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
