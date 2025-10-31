import { inject, Injectable } from '@angular/core';
import * as Notify from 'notifyjs';
import { Subject } from 'rxjs';
import { AlertService } from './alert.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  public onPermissionChange: Subject<boolean> = new Subject<boolean>();
  private alertService: AlertService = inject(AlertService);

  constructor() {
    this.allowNotifications();
  }

  private _permissionGranted = false;

  get permissionGranted(): boolean {
    return this._permissionGranted;
  }

  set permissionGranted(value: boolean) {
    if (value) {
      this.allowNotifications();
    } else {
      this._permissionGranted = false;
      this.onPermissionChange.next(false);
    }
  }

  public allowNotifications() {
    if (Notify.needsPermission && Notify.isSupported()) {
      Notify.requestPermission(this.onPermissionGranted, this.onPermissionDenied);
    } else {
      this._permissionGranted = !Notify.needsPermission;
    }
    this.onPermissionChange.next(this._permissionGranted);
  }

  public showNotification(title: string, body: string, type: 'danger' | 'warning' | 'info' | 'success') {
    if (this.permissionGranted) {
      const myNotification = new Notify(title, {
        body,
        timeout: 30,
      });

      myNotification.show();
    } else {
      this.alertService.showAlert(type, body);
    }
  }

  private onPermissionGranted = () => {
    this._permissionGranted = true;
    this.onPermissionChange.next(this._permissionGranted);
  };

  private onPermissionDenied = () => {
    this._permissionGranted = false;
    console.warn('Permission has been denied by the user');
    this.onPermissionChange.next(this._permissionGranted);
  };
}
