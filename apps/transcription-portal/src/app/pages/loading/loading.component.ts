import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { RoutingService } from '../../routing.service';
import { AppStoreService } from '../../store';

@Component({
  selector: 'tportal-loading',
  imports: [TranslocoPipe],
  templateUrl: './loading.component.html',
  styleUrl: './loading.component.scss',
})
export class LoadingComponent extends SubscriberComponent {
  private appStoreService = inject(AppStoreService);
  private route = inject(ActivatedRoute);
  private routingService = inject(RoutingService);

  error?: string;

  constructor() {
    super();

    this.subscribe(this.appStoreService.appInitialized$, {
      next: (initialized) => {
        if (initialized) {
          const mode = this.route.snapshot.queryParams['mode'];
          this.routingService.removeStaticParam('mode');
          this.routingService.navigate('navigate after settings loaded', mode ? [mode] : ['/'], {
            queryParams: {
              mode: null,
            },
            queryParamsHandling: 'replace',
          });
        }
      },
      error: (error: Error) => {
        this.error = error.message;
      },
    });
  }
}
