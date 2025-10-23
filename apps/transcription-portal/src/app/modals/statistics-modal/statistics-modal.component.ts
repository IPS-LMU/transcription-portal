import { AfterViewInit, Component, OnDestroy, inject } from '@angular/core';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { ChartConfiguration } from 'chart.js';
import { NgCircleProgressModule } from 'ng-circle-progress';
import { BaseChartDirective } from 'ng2-charts';
import { timer } from 'rxjs';
import { TaskService } from '../../obj/tasks/task.service';
import { StatisticsService } from '../../shared/statistics.service';

@Component({
  selector: 'tportal-statistics',
  templateUrl: './statistics-modal.component.html',
  styleUrls: ['./statistics-modal.component.scss'],
  providers: [StatisticsService],
  imports: [NgCircleProgressModule, BaseChartDirective],
})
export class StatisticsModalComponent extends SubscriberComponent implements OnDestroy, AfterViewInit {
  statisticsService = inject(StatisticsService);
  taskService = inject(TaskService);
  protected activeModal = inject(NgbActiveModal);

  public static options: NgbModalOptions = {
    size: 'xl',
    backdrop: true,
    fullscreen: 'xl',
  };
  showCharts = false;

  // Pie
  public pieChartType: ChartConfiguration['type'] = 'pie';

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    animation: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
      },
    },
  };

  override ngOnDestroy() {
    super.ngOnDestroy();
    this.statisticsService.destroy();
  }

  ngAfterViewInit() {
    this.subscribe(timer(1000), {
      next: () => {
        this.showCharts = true;
      },
    });
  }
}
