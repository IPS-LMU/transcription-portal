import { Injectable, inject } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { RoutingService } from '../routing.service';
import { AppSettings } from './app.settings';
import { CompatibilityService } from './compatibility.service';

@Injectable({
  providedIn: 'root',
})
export class CompatibilityGuard implements CanActivate {
  private router = inject(Router);
  private compatibility = inject(CompatibilityService);
  private routingService = inject(RoutingService);


  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Promise<boolean> {
    this.routingService.addStaticParams(route.queryParams);

    return new Promise<boolean>((resolve, reject) => {
      new Promise<void>((resolve2, reject2) => {
        if (AppSettings.configuration) {
          resolve2();
        } else {
          this.routingService.navigate('config not loaded', ['/loading']);
        }
      }).then(() => {
        this.compatibility.testCompability().then((result) => {
          if (result) {
            resolve(true);
          } else {
            if (route.url.length === 0) {
              resolve(result);
              this.routingService.navigate('route to test page', ['test']);
            } else {
              resolve(true);
            }
          }
        });
      });
    });
  }
}
