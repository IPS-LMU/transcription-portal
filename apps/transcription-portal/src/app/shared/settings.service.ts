import { Injectable, OnDestroy } from '@angular/core';
import { SubscriptionManager } from '@octra/utilities';
import { Subscription } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SettingsService implements OnDestroy {
  public shortCutsEnabled = true;
  private subscrManager = new SubscriptionManager<Subscription>();

  ngOnDestroy() {
    this.subscrManager.destroy();
  }
}
