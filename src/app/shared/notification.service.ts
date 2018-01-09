import {Injectable} from '@angular/core';

declare var Notify: any;

@Injectable()
export class NotificationService {
  set permissionGranted(value: boolean) {
    if (value) {
      this.allowNotifications();
    } else {
      this._permissionGranted = false;
    }
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
      console.log('requestPermission');
      Notify.requestPermission(this.onPermissionGranted, this.onPermissionDenied);
    } else {
      console.log(`no permissions needed`);
    }

    this._permissionGranted = !Notify.needsPermission;
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
