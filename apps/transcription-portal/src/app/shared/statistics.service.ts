import { Injectable } from '@angular/core';
import { SubscriptionManager } from '@octra/utilities';
import { ChartData } from 'chart.js';
import { interval, Subscription } from 'rxjs';
import { TaskService } from '../obj/tasks/task.service';

@Injectable({
  providedIn: 'root',
})
export class StatisticsService {
  public overAllProgress = {
    waiting: 0,
    processing: 0,
    finished: 0,
    failed: 0,
  };

  public averageDurations: ChartData<'pie', number[], string | string[]> = {
    labels: [
      ['Upload'],
      ['Speech Recognition'],
      ['Manual Transcription'],
      ['Word alignment'],
      ['Phonetic Detail'],
    ],
    datasets: [
      {
        data: [0, 0, 0, 0, 0],
      },
    ],
  };

  private subscrmanager = new SubscriptionManager<Subscription>();

  constructor(private taskService: TaskService) {
    this.subscrmanager.add(
      interval(1000).subscribe(() => {
        const allTasks = [
          ...this.taskService.state.modes.annotation.taskList?.getAllTasks() ?? [],
          ...this.taskService.state.modes.summarization.taskList?.getAllTasks() ?? [],
        ];
        const allTasksCount = allTasks.length;
        this.overAllProgress.waiting =
          ((this.taskService.statistics.waiting +
              this.taskService.statistics.queued) /
            allTasksCount) *
          100;
        this.overAllProgress.failed =
          (this.taskService.statistics.errors / allTasksCount) * 100;
        this.overAllProgress.processing =
          (this.taskService.statistics.running / allTasksCount) * 100;
        this.overAllProgress.finished =
          (this.taskService.statistics.finished / allTasksCount) * 100;

        this.updateAverageDurations();
      }),
    );
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  public updateAverageDurations() {
    // TODO implement
    /*
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
        this.averageDurations.datasets[0].data[i] =
          Math.ceil((durations[i] / 1000 / 60) * 100) / 100;
      }
    }
     */
  }
}
