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
          this.router.navigate(['/loading']);
        }
      }).then(() => {
        this.compatibility.testCompability().then((result) => {
          if (result) {
            resolve(true);
          } else {
            if (route.url.length === 0) {
              resolve(result);
              this.router.navigate(['test']);
            } else {
              resolve(true);
            }
          }
        });
      });
    });
  }
}
