import { Injectable, OnDestroy } from '@angular/core';
import { SubscriptionManager } from '@octra/utilities';
import { Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SettingsService implements OnDestroy {
  public shortCutsEnabled = true;
  private _feedbackEnabled = false;
  private subscrManager = new SubscriptionManager<Subscription>();

  get feedbackEnabled(): boolean {
    return this._feedbackEnabled;
  }

  ngOnDestroy() {
    this.subscrManager.destroy();
  }
}
