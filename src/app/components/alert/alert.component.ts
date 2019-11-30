import {Component, OnDestroy, OnInit} from '@angular/core';
import {AlertService} from '../../shared/alert.service';
import {ANIMATIONS} from '../../shared/Animations';
import {interval, Subject, Subscription} from 'rxjs';

export interface AlertEntry {
  type: 'danger' | 'warning' | 'info' | 'success';
  message: string;
  duration: number;
  animation: string;
  id: number;
}

@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.css'],
  animations: ANIMATIONS
})

export class AlertComponent implements OnInit, OnDestroy {

  private static counter = 0;
  public duration = 20;
  public queue: AlertEntry[] = [];
  public animation = 'closed';
  private _success = new Subject<string>();
  private counter: Subscription;

  constructor(private alert: AlertService) {
    this.alert.alertsend.subscribe(
      obj => this.onAlertSend(obj),
      (err) => {
        console.error(err);
      }
    );

    this.counter = interval(1000).subscribe(
      () => {
        for (const queueItem of this.queue) {
          queueItem.duration--;
          if (queueItem.duration === 0) {
            queueItem.animation = 'closed';
            this.removeFromQueue(queueItem);
          }
        }
      }
    );
  }

  ngOnDestroy() {
    this.counter.unsubscribe();
  }

  onAlertSend(obj: {
    type: 'danger' | 'warning' | 'info' | 'success',
    message: string,
    duration: number
  }) {
    this.animation = 'opened';
    if (obj.type === 'danger' || obj.type === 'warning' || obj.type === 'info' || obj.type === 'success') {
      const entry: AlertEntry = {
        type: obj.type,
        animation: 'opened',
        duration: obj.duration,
        message: obj.message,
        id: ++AlertComponent.counter
      };

      this.queue.push(entry);
    }
  }

  ngOnInit(): void {
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
