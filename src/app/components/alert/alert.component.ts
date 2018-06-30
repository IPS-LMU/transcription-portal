import {Component, OnDestroy, OnInit} from '@angular/core';
import {Subject} from 'rxjs/Subject';
import {AlertService} from '../../shared/alert.service';
import {interval} from 'rxjs/observable/interval';
import {ANIMATIONS} from '../../shared/Animations';
import {Subscription} from 'rxjs/Subscription';

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
  private _success = new Subject<string>();
  private static counter = 0;
  public duration = 20;
  private counter: Subscription;

  public queue: AlertEntry[] = [];

  public animation = 'closed';

  constructor(private alert: AlertService) {
    this.alert.alertsend.subscribe(
      obj => this.onAlertSend(obj),
      (err) => {
        console.error(err);
      }
    );

    this.counter = interval(1000).subscribe(
      () => {
        for (let i = 0; i < this.queue.length; i++) {
          const queueItem: AlertEntry = this.queue[i];
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
        console.log(`queue length is ${this.queue.length}`);
      }, 500);
    }
  }

  public clear() {
    for (let i = 0; i < this.queue.length; i++) {
      const queueItem = this.queue[i];
      queueItem.animation = 'closed';
    }

    this.animation = 'closed';
    setTimeout(() => {
      this.queue = [];
    }, 1000);
  }
}
