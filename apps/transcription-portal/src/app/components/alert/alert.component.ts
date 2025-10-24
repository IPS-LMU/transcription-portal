import { NgStyle } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NgbAlert } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { interval } from 'rxjs';
import { AlertService } from '../../shared/alert.service';
import { ANIMATIONS } from '../../shared/Animations';

export interface AlertEntry {
  type: 'danger' | 'warning' | 'info' | 'success';
  message: string;
  duration: number;
  animation: string;
  id: number;
}

@Component({
  selector: 'tportal-alert',
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss'],
  animations: ANIMATIONS,
  imports: [NgStyle, NgbAlert],
})
export class AlertComponent extends SubscriberComponent {
  private alert = inject(AlertService);

  private static counter = 0;
  public duration = 20;
  public queue: AlertEntry[] = [];
  public animation = 'closed';

  constructor() {
    super();
    this.subscribe(this.alert.alertsend, {
      next: (obj) => this.onAlertSend(obj),
      error: (err) => {
        console.error(err);
      },
    });

    this.subscribe(interval(1000), {
      next: () => {
        for (const queueItem of this.queue) {
          queueItem.duration--;
          if (queueItem.duration === 0) {
            queueItem.animation = 'closed';
            this.removeFromQueue(queueItem);
          }
        }
      },
    });
  }

  onAlertSend(obj: { type: 'danger' | 'warning' | 'info' | 'success'; message: string; duration: number }) {
    this.animation = 'opened';
    if (obj.type === 'danger' || obj.type === 'warning' || obj.type === 'info' || obj.type === 'success') {
      const entry: AlertEntry = {
        type: obj.type,
        animation: 'opened',
        duration: obj.duration,
        message: obj.message,
        id: ++AlertComponent.counter,
      };

      this.queue.push(entry);
    }
  }

  onClose(entry: AlertEntry) {
    entry.animation = 'closed';
    this.removeFromQueue(entry);
  }

  public clear() {
    for (const queueItem of this.queue) {
      queueItem.animation = 'closed';
    }

    this.animation = 'closed';
    setTimeout(() => {
      this.queue = [];
    }, 1000);
  }

  private removeFromQueue(entry: AlertEntry) {
    let index = this.queue.findIndex((a) => {
      return a.id === entry.id;
    });

    if (index > -1) {
      if (this.queue.length <= 1) {
        this.animation = 'closed';
      }

      setTimeout(() => {
        index = this.queue.findIndex((a) => {
          return a.id === entry.id;
        });
        this.queue.splice(index, 1);
        if (this.queue.length === 0) {
          this.animation = 'closed';
        }
      }, 500);
    }
  }
}
