import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VersionCheckerService, VersionNotificationComponent } from '@octra/ngx-components';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { ANIMATIONS } from './shared/Animations';
import { NotificationService } from './shared/notification.service';
import { AppStoreService, ModeStoreService } from './store';

@Component({
  selector: 'tportal-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  animations: [ANIMATIONS],
  imports: [RouterOutlet, VersionNotificationComponent],
})
export class AppComponent extends SubscriberComponent implements OnDestroy {
  notification = inject(NotificationService);
  appStoreService = inject(AppStoreService);
  versionChecker = inject(VersionCheckerService);
  modeStoreService = inject(ModeStoreService);

  constructor() {
    super();
    this.appStoreService.initApplication();
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
    this.modeStoreService.destroy();
  }
}
