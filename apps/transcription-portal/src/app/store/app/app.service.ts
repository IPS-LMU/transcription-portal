import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { ExternalInformationActions } from '../external-information/external-information.actions';
import { AppActions } from './app.actions';
import { RootState } from './app.reducer';
import {
  selectAccessCode,
  selectAppInitialized,
  selectAppSettings,
  selectAvailableLanguages,
  selectFeedbackEnabled,
  selectIDBBackup,
  selectUserProfile,
} from './app.selectors';

@Injectable({ providedIn: 'root' })
export class AppStoreService {
  store: Store<RootState> = inject(Store);
  appInitialized$ = this.store.select(selectAppInitialized);
  appSettings$ = this.store.select(selectAppSettings);
  availableLanguages$ = this.store.select(selectAvailableLanguages);
  accessCode$ = this.store.select(selectAccessCode);
  idbBackup$ = this.store.select(selectIDBBackup);
  feedbackEnabled$ = this.store.select(selectFeedbackEnabled);
  userProfile$ = this.store.select(selectUserProfile);

  initApplication() {
    this.store.dispatch(AppActions.initApplication.do());
  }

  updateASRInfo() {
    this.store.dispatch(ExternalInformationActions.updateASRInfo.do());
  }

  changeNotificationEnabled(enabled: boolean) {
    this.store.dispatch(AppActions.changeNotificationEnabled.do({ enabled }));
  }

  changeSidebarWidth(sidebarWidth: number) {
    this.store.dispatch(AppActions.changeSidebarWidth.do({ sidebarWidth }));
  }

  changeAccessCode(accessCode: string) {
    this.store.dispatch(AppActions.changeAccessCode.do({ accessCode }));
  }

  changeUserProfile(name: string, email: string) {
    this.store.dispatch(AppActions.saveUserProfile.do({ name, email }));
  }
}
