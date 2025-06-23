import { Injectable, inject } from '@angular/core';
import {
  ActivatedRoute,
  NavigationExtras,
  QueryParamsHandling,
  Router,
} from '@angular/router';
import { removeEmptyProperties, SubscriptionManager } from '@octra/utilities';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class RoutingService {
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  get staticQueryParams(): any {
    return this._staticQueryParams;
  }

  private _staticQueryParams: any = {};
  private subscrManager = new SubscriptionManager();

  // Observable exposing the breadcrumb hierarchy
  constructor() {
    this.subscrManager.add(
      this.activatedRoute.queryParams.subscribe((params) => {
        console.log('ROUTER SERVICE PARAMS');
        console.log(params);
      }),
    );
  }

  public removeStaticParam(name: string) {
    if (Object.keys(this._staticQueryParams).includes(name)) {
      this.staticQueryParams[name] = undefined;
    }
  }

  public addStaticParams(params: Record<string, string | undefined | null>) {
    this._staticQueryParams = {
      ...removeEmptyProperties<Record<string, string | undefined | null>>(
        params,
      ),
      ...params,
    };
  }

  public async navigate(
    label: string,
    commands: any[],
    extras?: NavigationExtras,
    queryParamsHandling: QueryParamsHandling | null | undefined = 'merge',
  ) {
    try {
      if (
        environment.debugging.enabled &&
        environment.debugging.logging.routes
      ) {
        console.log(`[RS/${label}] navigate to ${commands.join('/')}`);
      }
      await this.router.navigate(commands, {
        ...extras,
        queryParams: {
          ...extras?.queryParams,
          ...this._staticQueryParams,
        },
        queryParamsHandling,
      });
      const joined = commands.join('/');
      if (joined !== '/load') {
        // this.sessionStorage.store('last_page_path', joined);
      }
    } catch (e) {
      console.error(e);
    }
  }
}
