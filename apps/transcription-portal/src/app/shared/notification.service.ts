import { Injectable } from '@angular/core';
import * as Notify from 'notifyjs';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  public onPermissionChange: Subject<boolean> = new Subject<boolean>();

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

  public showNotification(title: string, body: string) {
    if (this.permissionGranted) {
      const myNotification = new Notify(title, {
        body,
        timeout: 30,
      });

      myNotification.show();
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
