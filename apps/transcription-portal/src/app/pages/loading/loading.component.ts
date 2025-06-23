
import { Component, inject } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { RoutingService } from '../../routing.service';
import { SettingsService } from '../../shared/settings.service';

@Component({
  selector: 'tportal-loading',
  imports: [],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent extends SubscriberComponent {
  private settingsService = inject(SettingsService);
  private routingServer = inject(RoutingService);

  error?: string;

  constructor() {
    super();
    this.subscribe(this.settingsService.settingsload, {
      next: (result) => {
        this.routingServer.navigate('navigate after settings loaded', ['/'], {
          queryParamsHandling: 'merge',
        });
      },
      error: (error: Error) => {
        this.error = error.message;
      },
    });
  }
}
