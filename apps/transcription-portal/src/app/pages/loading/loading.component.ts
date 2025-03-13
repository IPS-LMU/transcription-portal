import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { RoutingService } from '../../routing.service';
import { SettingsService } from '../../shared/settings.service';

@Component({
  selector: 'tportal-loading',
  imports: [CommonModule],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent extends SubscriberComponent {
  error?: string;

  constructor(
    private settingsService: SettingsService,
    private routingServer: RoutingService,
  ) {
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
