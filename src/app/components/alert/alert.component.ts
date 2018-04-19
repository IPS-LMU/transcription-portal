import {Component, OnInit} from '@angular/core';
import {Subject} from 'rxjs/Subject';
import {AlertService} from '../../shared/alert.service';
import {interval} from 'rxjs/observable/interval';
import {ANIMATIONS} from '../../shared/Animations';
import {Subscription} from 'rxjs/Subscription';
import {isNullOrUndefined} from 'util';

@Component({
  selector: 'app-alert',
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.css'],
  animations: ANIMATIONS
})
export class AlertComponent implements OnInit {
  get message(): string {
    return this._message;
  }

  private _success = new Subject<string>();
  private _message = '';
  private type: 'danger' | 'warning' | 'info' | 'success' = 'danger';
  public duration = 20;
  private counter: Subscription;

  public animation = 'closed';

  constructor(private alert: AlertService) {
    this.alert.alertsend.subscribe(
      obj => this.onAlertSend(obj),
      (err) => {
        console.error(err);
      }
    );
  }

  onAlertSend(obj: {
    type: 'danger' | 'warning' | 'info' | 'success',
    message: string,
    duration: number
  }) {
    if (obj.type === 'danger' || obj.type === 'warning' || obj.type === 'info' || obj.type === 'success') {
      this.type = obj.type;
      this._message = obj.message;
      this.animation = 'opened';
      this.duration = obj.duration;

      if (!isNullOrUndefined(this.counter)) {
        this.counter.unsubscribe();
      }

      this.counter = interval(1000).subscribe(
        () => {
          this.duration--;
          if (this.duration <= 0) {
            this.animation = 'closed';
            this.counter.unsubscribe();
          }
        }
      );
    }
  }

  ngOnInit(): void {
  }

  onClose() {
    this.animation = 'closed';
    this.counter.unsubscribe();
  }
}
