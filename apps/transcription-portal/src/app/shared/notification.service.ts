import { EventEmitter, Injectable } from '@angular/core';
import Notify from 'notifyjs';
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

  public showNotification(
    title: string,
    body: string,
    options: {
      type: 'desktop' | 'alert' | 'auto';
      messageType: 'danger' | 'warning' | 'info' | 'success';
      duration?: number;
    } = {
      type: 'auto',
      messageType: 'info',
      duration: 5,
    },
  ) {
    if (this.permissionGranted && options.type !== 'alert') {
      this.showDesktopNotification(title, body);
    } else {
      this.showAlert(options.messageType, body, options.duration);
    }
  }

  private showDesktopNotification(title: string, body: string) {
    const elem = document.createElement('div');
    elem.innerHTML = body;
    const myNotification = new Notify(title, {
      body: elem.innerText,
      icon: 'assets/img/TPortal-Logo_only_512p.png',
      timeout: 30,
    });

    myNotification.show();
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

  public alertsend = new EventEmitter<{
    type: 'danger' | 'warning' | 'info' | 'success';
    message: string;
    duration: number;
  }>();

  private showAlert(type: 'danger' | 'warning' | 'info' | 'success', message: string, duration?: number) {
    this.alertsend.emit({
      type,
      message,
      duration: duration !== undefined ? duration : 5,
    });
  }
}
