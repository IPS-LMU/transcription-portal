import {Injectable} from '@angular/core';
import {ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot} from '@angular/router';
import {Observable} from 'rxjs';
import {CompatibilityService} from './compatibility.service';
import {SettingsService} from './settings.service';
import {AppSettings} from './app.settings';

@Injectable({
  providedIn: 'root'
})
export class CompatibilityGuard implements CanActivate {
  constructor(private router: Router, private compatibility: CompatibilityService, private settingsService: SettingsService) {

  }

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): Observable<boolean> | Promise<boolean> | boolean {

    return new Promise<boolean>((resolve, reject) => {
      new Promise<void>((resolve2, reject2) => {
        if (!(AppSettings.configuration === null || AppSettings.configuration === undefined)) {
          resolve2();
        } else {
          const subscr = this.settingsService.settingsload.subscribe(() => {
            resolve2();
            subscr.unsubscribe();
          });
        }
      }).then(() => {
        this.compatibility.testCompability().then((result) => {
          if (result) {
            if (next.url.length > 0) {
              this.router.navigate(['']);
            }
            resolve(true);
          } else {
            if (next.url.length === 0) {
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
