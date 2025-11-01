import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VersionCheckerService, VersionNotificationComponent } from '@octra/ngx-components';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { TaskService } from './obj/tasks/task.service';
import { ANIMATIONS } from './shared/Animations';
import { NotificationService } from './shared/notification.service';
import { AppStoreService } from './store';

@Component({
  selector: 'tportal-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [ANIMATIONS],
  imports: [RouterOutlet, VersionNotificationComponent],
})
export class AppComponent extends SubscriberComponent implements OnDestroy {
  taskService = inject(TaskService);
  notification = inject(NotificationService);
  appStoreService = inject(AppStoreService);
  versionChecker = inject(VersionCheckerService);

  constructor() {
    super();
    this.appStoreService.initApplication();
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this.taskService.destroy();
  }
}
