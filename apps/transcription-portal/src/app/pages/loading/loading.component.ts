import { Component, inject } from '@angular/core';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { RoutingService } from '../../routing.service';
import { AppStoreService } from '../../store';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tportal-loading',
  imports: [TranslocoPipe],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent extends SubscriberComponent {
  private appStoreService = inject(AppStoreService);
  private routingServer = inject(RoutingService);

  error?: string;

  constructor() {
    super();
    this.subscribe(this.appStoreService.appInitialized$, {
      next: (initialized) => {
        if (initialized) {
          this.routingServer.navigate('navigate after settings loaded', ['/'], {
            queryParamsHandling: 'merge',
          });
        }
      },
      error: (error: Error) => {
        this.error = error.message;
      },
    });
  }
}
