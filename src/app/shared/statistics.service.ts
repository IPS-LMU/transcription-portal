import {Injectable} from '@angular/core';
import {TaskService} from '../obj/tasks/task.service';
import {SubscriptionManager} from './subscription-manager';
import {interval} from 'rxjs';

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

  public averageDurations = {
    labels: ['Upload', 'Speech Recognition', 'Manual Transcription', 'Word alignment'],
    data: [0, 0, 0, 0]
  };

  private subscrmanager = new SubscriptionManager();

  constructor(private taskService: TaskService) {
    this.subscrmanager.add(interval(1000).subscribe(() => {
      const allTasks = this.taskService.taskList.getAllTasks();

      if (!(allTasks === null || allTasks === undefined)) {
        const allTasksCount = allTasks.length;
        this.overAllProgress.waiting = (this.taskService.statistics.waiting + this.taskService.statistics.queued) / allTasksCount * 100;
        this.overAllProgress.failed = this.taskService.statistics.errors / allTasksCount * 100;
        this.overAllProgress.processing = this.taskService.statistics.running / allTasksCount * 100;
        this.overAllProgress.finished = this.taskService.statistics.finished / allTasksCount * 100;

        this.updateAverageDurations();
      }
    }));
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  public updateAverageDurations() {
    const tasks = this.taskService.taskList.getAllTasks();

    const durations = [0, 0, 0, 0];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];

      for (let j = 0; j < task.operations.length - 1; j++) {
        const operation = task.operations[j];

        durations[j] += operation.time.duration;
      }
    }

    const sum = durations[0] + durations[1] + durations[2] + durations[3];

    for (let i = 0; i < this.averageDurations.data.length; i++) {
      this.averageDurations.data[i] = Math.ceil(durations[i] / 1000 / 60 * 100) / 100;
    }
  }
}
