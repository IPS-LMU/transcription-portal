import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { AppActions } from './app.actions';
import { RootState } from './app.reducer';

@Injectable({ providedIn: 'root' })
export class AppStoreService {
  store: Store<RootState> = inject(Store);

  initApplication() {
    this.store.dispatch(AppActions.initApplication.do());
  }
}
