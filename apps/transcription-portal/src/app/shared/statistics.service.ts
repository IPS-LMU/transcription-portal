import { inject, Injectable } from '@angular/core';
import { SubscriptionManager } from '@octra/utilities';
import { ChartData } from 'chart.js';
import { interval, Subscription } from 'rxjs';
import { TaskService } from '../obj/tasks/task.service';

@Injectable()
export class StatisticsService {
  private taskService = inject(TaskService);

  public overAllProgress = {
    waiting: 0,
    processing: 0,
    finished: 0,
    failed: 0,
  };

  public averageDurations?: ChartData<'pie', number[], string | string[]>;

  private subscrmanager = new SubscriptionManager<Subscription>();

  constructor() {
    this.subscrmanager.add(
      interval(1000).subscribe(() => {
        const modeState = this.taskService.state.modes[this.taskService.state.currentMode];
        const allTasks = [...(modeState.taskList?.getAllTasks() ?? [])];
        const allTasksCount = allTasks.length;
        this.overAllProgress.waiting = ((modeState.statistics.waiting + modeState.statistics.queued) / allTasksCount) * 100;
        this.overAllProgress.failed = (modeState.statistics.errors / allTasksCount) * 100;
        this.overAllProgress.processing = (modeState.statistics.running / allTasksCount) * 100;
        this.overAllProgress.finished = (modeState.statistics.finished / allTasksCount) * 100;
        this.updateAverageDurations(this.taskService.state.currentMode);
      }),
    );
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  public updateAverageDurations(mode: 'annotation' | 'summarization') {
    if (this.taskService.statistics && this.taskService.state?.modes && Object.keys(this.taskService.state.modes).includes(mode)) {
      const modeState = this.taskService.state.modes[mode];
      const tasks = modeState.taskList?.getAllTasks() ?? [];

      const durations = [0, 0, 0, 0, 0];

      for (const task of tasks) {
        for (let j = 0; j < task.operations.length; j++) {
          const operation = task.operations[j];

          durations[j] += operation.time.duration;
        }
      }

      if (mode === 'annotation') {
        this.averageDurations = {
          labels: [['Upload'], ['Speech Recognition'], ['Manual Transcription'], ['Word alignment'], ['Phonetic Detail']],
          datasets: [
            {
              data: [0, 0, 0, 0, 0],
            },
          ],
        };
      } else {
        this.averageDurations = {
          labels: [['Upload'], ['Speech Recognition'], ['Manual Transcription'], ['Summarization'], ['Translation']],
          datasets: [
            {
              data: [0, 0, 0, 0, 0],
            },
          ],
        };
      }

      for (let i = 0; i < this.averageDurations.datasets[0].data.length; i++) {
        this.averageDurations.datasets[0].data[i] = Math.ceil((durations[i] / 1000 / 60) * 100) / 100;
      }
    }
  }
}
