import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {StatisticsService} from '../../shared/statistics.service';
import {TaskService} from '../../obj/tasks/task.service';
import {ModalDirective} from 'ngx-bootstrap';
import {ChartType} from 'chart.js';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics-modal.component.html',
  styleUrls: ['./statistics-modal.component.css']
})
export class StatisticsModalComponent implements OnInit, OnDestroy {

  @ViewChild('statisticsModal', {static: true}) statisticsModal: ModalDirective;
  // Pie
  public pieChartType: ChartType = 'pie';
  private _subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor(public statisticsService: StatisticsService, public taskService: TaskService) {
  }

  // events
  public chartClicked(e: any): void {
  }

  public chartHovered(e: any): void {
  }

  ngOnDestroy() {
    this._subscrmanager.destroy();
    this.statisticsService.destroy();
  }

  ngOnInit() {
  }

  public open() {
    this._subscrmanager.add(this.statisticsModal.onShown.subscribe(() => {
    }));
    this.statisticsModal.show();
  }
}
