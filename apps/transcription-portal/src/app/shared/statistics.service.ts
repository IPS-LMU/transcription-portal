import { inject, Injectable } from '@angular/core';
import { sum } from '@octra/api-types';
import { SubscriptionManager } from '@octra/utilities';
import { ChartData } from 'chart.js';
import { Subscription } from 'rxjs';
import { ModeStoreService, StoreItem, StoreItemTask } from '../store';
import { getLastOperationRound } from '../store/operation/operation.functions';

@Injectable()
export class StatisticsService {
  private modeStoreService = inject(ModeStoreService);
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
      this.modeStoreService.currentModeStatistics$.subscribe({
        next: (statistics) => {
          const allTasksCount = sum(Object.keys(statistics).map((a) => (statistics as any)[a]!));
          this.overAllProgress.waiting = ((statistics.waiting + statistics.queued) / allTasksCount) * 100;
          this.overAllProgress.failed = (statistics.errors / allTasksCount) * 100;
          this.overAllProgress.processing = (statistics.running / allTasksCount) * 100;
          this.overAllProgress.finished = (statistics.finished / allTasksCount) * 100;

          // this.updateAverageDurations(this.taskService.state.currentMode);
        },
      }),
    );

    this.subscrmanager.add(
      this.modeStoreService.currentModeEntries$.subscribe({
        next: (items) => {
          const flat = (item: StoreItem): StoreItemTask[] => {
            if (item.type === 'task') {
              return [item as StoreItemTask];
            }
            return item
              .entries!.ids.map((id) => item.entries!.entities[id]!)
              .map(flat)
              .flat();
          };

          const tasks = items.map(flat).flat();
          this.updateAverageDurations(tasks);
        },
      }),
    );
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  public updateAverageDurations(tasks: StoreItemTask[]) {
    const durations = [0, 0, 0, 0, 0];

    for (const task of tasks) {
      for (let j = 0; j < task.operations.length; j++) {
        const operation = task.operations[j];

        durations[j] += getLastOperationRound(operation)?.time?.duration ?? 0;
      }
    }

    if (this.modeStoreService.currentMode === 'annotation') {
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
