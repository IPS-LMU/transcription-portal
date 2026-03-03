import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { AppStoreService } from '../../store';
import { RoutingService } from '../../routing.service';

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
          this.routingService.navigate('navigate after settings loaded', mode ? [mode] : ['/'], {
            queryParams: {
              mode: undefined,
            },
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
