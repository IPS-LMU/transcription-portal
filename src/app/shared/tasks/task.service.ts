import { HttpClient } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { isNullOrUndefined } from 'util';
import { NotificationService } from '../notification.service';
import { SubscriptionManager } from '../subscription-manager';
import { Task, TaskState } from './obj';
import { ASROperation } from './obj/asr-operation';
import { Operation } from './obj/operation';
import { ToolOperation } from './obj/tool-operation';
import { UploadOperation } from './obj/upload-operation';
import { MAUSOperation } from './obj/maus-operation';

@Injectable()
export class TaskService implements OnDestroy {

  private options = {
    max_running_tasks: 3
  };
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  constructor(private httpclient: HttpClient, private notification: NotificationService) {
    this._operations = [
      new UploadOperation('Upload', '<span class="glyphicon glyphicon-upload"></span>'),
      new MAUSOperation('MAUS', null),
      new ASROperation('ASR', '<span class="glyphicon glyphicon-forward"></span>'),
      new ToolOperation('OCTRA', null),
      new Operation('Download', '<span class="glyphicon glyphicon-download"></span>')
    ];

    setInterval(() => {
      this.updateTimes();
    });
  }

  private _tasks: Task[] = [];

  get tasks(): Task[] {
    return this._tasks;
  }

  private _operations: Operation[] = [];

  get operations(): Operation[] {
    return this._operations;
  }

  getUploadSpeed() {
    if (this.tasks.length > 0) {
      let mid_speed = 0;
      for (let j = 0; j < this.tasks.length; j++) {
        if (this.tasks[ j ].operations[ 0 ].state === TaskState.FINISHED) {
          const duration = this.tasks[ j ].operations[ 0 ].time.end - this.tasks[ j ].operations[ 0 ].time.start;
          let size = 0;

          if (duration > 0) {
            for (let i = 0; i < this.tasks[ j ].files.length; i++) {
              size += this.tasks[ j ].files[ i ].size;
            }

            mid_speed += ((duration / 1000) / (size / 1000 / 1000));
          }
        }
      }

      // count tasks with upload state  FINISHED
      const finished_tasks = this.tasks.filter((a) => {
        return a.operations[ 0 ].state === TaskState.FINISHED;
      }).length;

      mid_speed = Math.round(mid_speed / finished_tasks * 10) / 10;

      if (mid_speed <= 0) {
        return -1;
      }

      return mid_speed;

    }
    return -1;
  }

  public addTask(task: Task) {
    this.tasks.push(task);
  }

  public start() {
    // look for pending tasks

    const running_tasks = this.countRunningTasks();
    if (running_tasks < this.options.max_running_tasks) {
      let task: Task;

      // look for pending tasks
      task = this.tasks.find((a) => {
        if (a.state === TaskState.PENDING) {
          return true;
        }
      });

      if (!isNullOrUndefined(task)) {
        this.subscrmanager.add(task.statechange.subscribe((event) => {
          if (event.oldState === TaskState.UPLOADING) {
            setTimeout(() => {
              this.start();
            }, 500);
          }

          const opName = task.getOperationByID(event.opID).name;
          if (opName === 'ASR' && event.newState === TaskState.FINISHED) {
            this.notification.showNotification('ASR Operation successful', 'You can now transcibe it with OCTRA');
          } else if (event.newState === TaskState.ERROR) {
            this.notification.showNotification(opName + ' Operation failed', 'Please have a look at the error log');
          }
        }));
        task.start(this.httpclient);
      }
    } else {
      console.log(running_tasks + ' running tasks');
      setTimeout(() => {
        this.start();
      }, 1000);
    }
  }

  public countRunningTasks() {
    let result = 0;

    for (let i = 0; i < this._tasks.length; i++) {
      const task = this._tasks[ i ];

      if (task.state !== TaskState.PENDING && task.operations[ 1 ].state !== TaskState.FINISHED) {
        result++;
      }
    }

    return result;
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  private updateTimes() {
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[ i ];
      let new_end = 0;

      let size = 0;

      for (let j = 0; j < this.tasks[ i ].files.length; j++) {
        size += this.tasks[ i ].files[ j ].size;
      }

      new_end = ((size / 1000 / 1000) * this.getUploadSpeed()) * 1000 + task.operations[ 0 ].time.start;

      task.operations[ 0 ].estimated_end = new_end;
    }
  }
}
