import {Component, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {StatisticsService} from '../../shared/statistics.service';
import {TaskService} from '../../obj/tasks/task.service';

@Component({
  selector: 'app-statistics',
  templateUrl: './statistics-modal.component.html',
  styleUrls: ['./statistics-modal.component.css']
})
export class StatisticsModalComponent implements OnInit, OnDestroy {

  @ViewChild('content') content: NgbModal;

  private _subscrmanager: SubscriptionManager = new SubscriptionManager();
  private modalRef: NgbModalRef;

  // Pie
  public pieChartLabels: string[] = ['Download Sales', 'In-Store Sales', 'Mail Sales'];
  public pieChartData: number[] = [300, 500, 100];
  public pieChartType: string = 'pie';
  public visible = false;

  // events
  public chartClicked(e: any): void {
    console.log(e);
  }

  public chartHovered(e: any): void {
    console.log(e);
  }

  ngOnDestroy() {
    this._subscrmanager.destroy();
    this.statisticsService.destroy();
  }

  constructor(private modalService: NgbModal, public statisticsService: StatisticsService, public taskService: TaskService) {
  }

  ngOnInit() {
  }

  public open() {
    this.modalRef = this.modalService.open(this.content, {
      size: 'lg'
    });
    setTimeout(() => {
      this.visible = true;
    }, 1000);
  }

  onClose() {
    this.visible = false;
    this.statisticsService.destroy();
  }

  onDismiss() {
    this.visible = false;
    this.statisticsService.destroy();
  }
}
