import {Injectable} from '@angular/core';
import {Subject} from 'rxjs/Subject';

declare var Notify: any;

@Injectable()
export class NotificationService {
  set permissionGranted(value: boolean) {
    if (value) {
      this.allowNotifications();
    } else {
      this._permissionGranted = false;
      this.onPermissionChange.next(false);
    }
  }

  get permissionGranted(): boolean {
    return this._permissionGranted;
  }

  private _permissionGranted = false;

  constructor() {
    this.allowNotifications();
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

  public onPermissionChange: Subject<boolean> = new Subject<boolean>();

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
        body   : body,
        timeout: 30
      });

      myNotification.show();
    }
  }
}
