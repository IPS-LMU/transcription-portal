import {Injectable} from '@angular/core';
import {TaskService} from '../obj/tasks/task.service';
import {SubscriptionManager} from './subscription-manager';
import {interval} from 'rxjs';
import {ChartConfiguration, ChartData} from 'chart.js';

@Injectable({
  providedIn: 'root'
})
export class StatisticsService {

  public overAllProgress = {
    waiting: 0,
    processing: 0,
    finished: 0,
    failed: 0
  };

  public averageDurations: ChartData<'pie', number[], string | string[]> = {
    labels: [['Upload', 'Speech Recognition', 'Manual Transcription', 'Word alignment', 'Phonetic Detail']],
    datasets: [{
      data: [0, 0, 0, 0, 0]
    }]
  };

  private subscrmanager = new SubscriptionManager();

  constructor(private taskService: TaskService) {
    this.subscrmanager.add(interval(1000).subscribe(() => {
      if (!(this.taskService.taskList === null || this.taskService.taskList === undefined)) {
        const allTasks = this.taskService.taskList.getAllTasks();

        if (!(allTasks === null || allTasks === undefined)) {
          const allTasksCount = allTasks.length;
          this.overAllProgress.waiting = (this.taskService.statistics.waiting + this.taskService.statistics.queued) / allTasksCount * 100;
          this.overAllProgress.failed = this.taskService.statistics.errors / allTasksCount * 100;
          this.overAllProgress.processing = this.taskService.statistics.running / allTasksCount * 100;
          this.overAllProgress.finished = this.taskService.statistics.finished / allTasksCount * 100;

          this.updateAverageDurations();
        }
      }
    }));
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  public updateAverageDurations() {
    if (this.taskService.taskList) {
      const tasks = this.taskService.taskList.getAllTasks();

      const durations = [0, 0, 0, 0, 0];

      for (const task of tasks) {
        for (let j = 0; j < task.operations.length; j++) {
          const operation = task.operations[j];

          durations[j] += operation.time.duration;
        }
      }

      for (let i = 0; i < this.averageDurations.datasets[0].data.length; i++) {
        this.averageDurations.datasets[0].data[i] = Math.ceil(durations[i] / 1000 / 60 * 100) / 100;
      }
    }
  }
}
