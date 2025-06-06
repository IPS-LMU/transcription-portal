import { EventEmitter, Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AlertService {
  public alertsend = new EventEmitter<{
    type: 'danger' | 'warning' | 'info' | 'success';
    message: string;
    duration: number;
  }>();

  constructor() {}

  public showAlert(
    type: 'danger' | 'warning' | 'info' | 'success',
    message: string,
    duration?: number,
  ) {
    this.alertsend.emit({
      type,
      message,
      duration: duration ? duration : 5,
    });
  }
}
