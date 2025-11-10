import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { ExternalInformationActions } from '../external-information/external-information.actions';
import { AppActions } from './app.actions';
import { RootState } from './app.reducer';
import { selectAppInitialized, selectAppSettings, selectAvailableLanguages } from './app.selectors';

@Injectable({ providedIn: 'root' })
export class AppStoreService {
  store: Store<RootState> = inject(Store);
  appInitialized$ = this.store.select(selectAppInitialized);
  appSettings$ = this.store.select(selectAppSettings);
  availableLanguages$ = this.store.select(selectAvailableLanguages);

  initApplication() {
    this.store.dispatch(AppActions.initApplication.do());
  }

  updateASRInfo() {
    this.store.dispatch(ExternalInformationActions.updateASRInfo.do());
  }
}
