import { Injectable } from '@angular/core';

declare var Notify: any;

@Injectable()
export class NotificationService {
  set permissionGranted(value: boolean) {
    this._permissionGranted = value;
  }

  get permissionGranted(): boolean {
    return this._permissionGranted;
  }

  private _permissionGranted = false;

  constructor() {
    this.allowNotifications();
  }

  private onPermissionGranted() {
    this._permissionGranted = true;
  }

  private onPermissionDenied() {
    this._permissionGranted = false;
    console.warn('Permission has been denied by the user');
  }

  public allowNotifications() {
    if (Notify.needsPermission && Notify.isSupported()) {
      Notify.requestPermission(this.onPermissionGranted, this.onPermissionDenied);
    }

    if (!Notify.needsPermission) {
      this._permissionGranted = true;
    }
  }

  public showNotification(title: string, body: string) {
    if (this.permissionGranted) {
      const myNotification = new Notify(title, {
        body   : body,
        timeout: 30
      });

      myNotification.show();
    }
  }
}
