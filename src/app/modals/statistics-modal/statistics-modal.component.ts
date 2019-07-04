import {Component, OnDestroy, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {StatisticsService} from '../../shared/statistics.service';
import {TaskService} from '../../obj/tasks/task.service';
import {BsModalRef, BsModalService, ModalDirective} from 'ngx-bootstrap';
import {ChartType} from 'chart.js';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics-modal.component.html',
  styleUrls: ['./statistics-modal.component.css']
})
export class StatisticsModalComponent implements OnInit, OnDestroy {

  @ViewChild('statisticsModal', {static: true}) statisticsModal: ModalDirective;

  private _subscrmanager: SubscriptionManager = new SubscriptionManager();

  // Pie
  public pieChartType: ChartType = 'pie';

  // events
  public chartClicked(e: any): void {
  }

  public chartHovered(e: any): void {
  }

  ngOnDestroy() {
    this._subscrmanager.destroy();
    this.statisticsService.destroy();
  }

  constructor(public statisticsService: StatisticsService, public taskService: TaskService) {
  }

  ngOnInit() {
  }

  public open() {
    this._subscrmanager.add(this.statisticsModal.onShown.subscribe(() => {
    }));
    this._subscrmanager.add(this.statisticsModal.onHidden.subscribe(this.onHidden));
    this.statisticsModal.show();
  }

  onHidden = () => {
    this.statisticsService.destroy();
  }
}
