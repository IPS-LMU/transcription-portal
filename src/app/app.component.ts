import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { isNullOrUndefined } from 'util';
import { AppInfo } from './app.info';
import { ANIMATIONS } from './shared/Animations';
import { NotificationService } from './shared/notification.service';
import { SubscriptionManager } from './shared/subscription-manager';
import { FileInfo } from './shared/tasks/obj/fileInfo';
import { Task } from './shared/tasks/obj/task';
import { TaskService } from './shared/tasks/task.service';

@Component({
  selector   : 'app-root',
  templateUrl: './app.component.html',
  styleUrls  : [ './app.component.css' ],
  providers  : [],
  animations : [ ANIMATIONS ]
})
export class AppComponent implements OnDestroy {
  protected showtool = false;
  public sidebarstate = 'hidden';

  public test = 'insactive';
  private subscrmanager = new SubscriptionManager();

  constructor(public taskService: TaskService, private httpclient: HttpClient, public notification: NotificationService) {
    this.subscrmanager.add(this.taskService.errorscountchange.subscribe(
      () => {
        console.log('ERROR! HERE');
        this.blop();
      }
    ));
  }

  public get AppInfo() {
    return AppInfo;
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  onAfterDrop(files: FileInfo[]) {
    console.log('dropped');
    if (!isNullOrUndefined(files) && !isNullOrUndefined(this.taskService.operations)) {
      const task = new Task(files, this.taskService.operations);

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

  blop() {
    this.test = 'blopped';
    setTimeout(() => {
      this.test = 'inactive';
    }, 500);
  }
}
