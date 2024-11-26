import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  CanActivate,
  Router,
  RouterStateSnapshot,
} from '@angular/router';
import { AppSettings } from './app.settings';
import { CompatibilityService } from './compatibility.service';
import { SettingsService } from './settings.service';

@Injectable({
  providedIn: 'root',
})
export class CompatibilityGuard implements CanActivate {
  constructor(
    private router: Router,
    private compatibility: CompatibilityService,
    private settingsService: SettingsService
  ) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      new Promise<void>((resolve2, reject2) => {
        if (AppSettings.configuration) {
          resolve2();
        } else {
          const subscr = this.settingsService.settingsload.subscribe(
            (loaded) => {
              if (loaded) {
                resolve2();
                subscr.unsubscribe();
              }
            }
          );
        }
      }).then(() => {
        this.compatibility.testCompability().then((result) => {
          if (result) {
            if (route.url.length > 0) {
              this.router.navigate(['']);
            }
            resolve(true);
          } else {
            if (route.url.length === 0) {
              this.router.navigate(['test']);
              resolve(result);
            } else {
              resolve(true);
            }
          }
        });
      });
    });
  }
}
