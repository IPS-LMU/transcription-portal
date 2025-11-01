import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { ExternalInformationActions } from '../external-information';
import { AppActions } from './app.actions';
import { RootState } from './app.reducer';
import { selectAppInitialized } from './app.selectors';

@Injectable({ providedIn: 'root' })
export class AppStoreService {
  store: Store<RootState> = inject(Store);
  appInitialized$ = this.store.select(selectAppInitialized);

  initApplication() {
    this.store.dispatch(AppActions.initApplication.do());
  }

  updateASRInfo() {
    this.store.dispatch(ExternalInformationActions.updateASRInfo.do());
  }
}
