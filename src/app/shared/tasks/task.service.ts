import { HttpClient } from '@angular/common/http';
import { EventEmitter, Injectable, OnDestroy } from '@angular/core';
import { isNullOrUndefined } from 'util';
import { NotificationService } from '../notification.service';
import { SubscriptionManager } from '../subscription-manager';
import { Task, TaskState } from './obj';
import { ASROperation } from './obj/asr-operation';
import { MAUSOperation } from './obj/maus-operation';
import { Operation } from './obj/operation';
import { ToolOperation } from './obj/tool-operation';
import { UploadOperation } from './obj/upload-operation';

@Injectable()
export class TaskService implements OnDestroy {
  get protocol_array(): any[] {
    return this._protocol_array;
  }

  get warnings_count(): number {
    return this._warnings_count;
  }

  get errors_count(): number {
    return this._errors_count;
  }

  private options = {
    max_running_tasks: 3
  };
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  private _errors_count = 0;
  private _warnings_count = 0;
  private _protocol_array = [];

  public errorscountchange = new EventEmitter<number>();

  constructor(private httpclient: HttpClient, private notification: NotificationService) {
    this._operations = [
      new UploadOperation('Upload', '<span class="glyphicon glyphicon-upload"></span>'),
      new MAUSOperation('MAUS', null),
      new ASROperation('ASR', '<span class="glyphicon glyphicon-forward"></span>'),
      new ToolOperation('OCTRA', null),
      new Operation('Download', '<span class="glyphicon glyphicon-download"></span>')
    ];
  }

  private _tasks: Task[] = [];

  get tasks(): Task[] {
    return this._tasks;
  }

  private _operations: Operation[] = [];

  get operations(): Operation[] {
    return this._operations;
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

          this.updateProtocolArray();
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

      if (task.state !== TaskState.PENDING && task.state !== TaskState.FINISHED && task.state !== TaskState.ERROR) {
        result++;
      }
    }

    return result;
  }

  ngOnDestroy() {
    for (let i = 0; i < this.tasks.length; i++) {
      this.tasks[ i ].destroy();
    }
    this.subscrmanager.destroy();
  }

  public updateProtocolArray() {
    const result = [];
    let errors_count = 0;
    let warnings_count = 0;

    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[ i ];

      for (let j = 0; j < task.operations.length; j++) {
        const operation = task.operations[ j ];

        if ((operation.state === TaskState.FINISHED || operation.state === TaskState.ERROR) && operation.protocol !== '') {
          if (operation.state === TaskState.ERROR) {
            errors_count++;
          } else {
            warnings_count++;
          }

          result.push(
            {
              state   : operation.state,
              protocol: operation.protocol
            }
          );
        }
      }
    }

    if (this.errors_count !== errors_count) {
      this.errorscountchange.emit(this.errors_count);
    }
    this._errors_count = errors_count;
    this._warnings_count = warnings_count;
    this._protocol_array = result;
  }
}
