import { HttpClient } from '@angular/common/http';
import { Component } from '@angular/core';
import { isNullOrUndefined } from 'util';
import { AppInfo } from './app.info';
import { NotificationService } from './shared/notification.service';
import { FileInfo } from './shared/tasks/obj/fileInfo';
import { Task } from './shared/tasks/obj/task';
import { TaskService } from './shared/tasks/task.service';

@Component({
  selector   : 'app-root',
  templateUrl: './app.component.html',
  styleUrls  : [ './app.component.css' ],
  providers  : []
})
export class AppComponent {
  protected showtool = false;
  public sidebarstate = 'hidden';

  constructor(public taskService: TaskService, private httpclient: HttpClient, public notification: NotificationService) {
  }

  public get AppInfo() {
    return AppInfo;
  }

  onAfterDrop(files: FileInfo[]) {
    console.log('dropped');
    if (!isNullOrUndefined(files) && !isNullOrUndefined(this.taskService.operations)) {
      const task = new Task(files, this.taskService.operations);

      for (let i = 2; i < task.operations.length; i++) {
        task.operations[ i ].start = () => {
          console.log('operation ' + i);
        };
      }
      this.taskService.addTask(task);
    }
  }

  onUploadButtonClick() {
    // start first operation of this task
    this.taskService.start();
  }

  onMissedDrop(event) {
    event.stopPropagation();
    event.preventDefault();
  }
}
