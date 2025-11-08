import { createReducer, on } from '@ngrx/store';
import { OHConfiguration, ProviderLanguage } from '../../obj/oh-config';
import { ExternalInformationState } from '../external-information';
import { IDBActions } from '../idb/idb.actions';
import { ModeActions } from '../mode/mode.actions';
import { AppActions } from './app.actions';
import { ExternalInformationActions } from '../external-information/external-information.actions';
import { ModeState } from '../mode';

export interface AppState {
  versionCheckerStarted: boolean;
  modesInitialized: boolean;
  consoleLoggingInitialized: boolean;
  idbInitialized: boolean;
  feedbackEnabled?: boolean;
  initialized: boolean;
  firstModalShown?: boolean;
  sidebarWidth?: number;
  accessCode?: string;
  notification?: boolean;
  protocolURL?: string;

  settings?: OHConfiguration;
  availableLanguages?: {
    asr: ProviderLanguage[];
    maus: ProviderLanguage[];
  };
}

export const InitialAppState: AppState = {
  versionCheckerStarted: false,
  modesInitialized: false,
  consoleLoggingInitialized: false,
  feedbackEnabled: false,
  idbInitialized: false,
  initialized: false,
};

export interface RootState {
  app: AppState;
  modes: ModeState;
  externalInformation: ExternalInformationState;
}

export const appReducer = createReducer(
  InitialAppState,
  on(
    AppActions.initApplication.success,
    (state: AppState): AppState => ({
      ...state,
      initialized: true,
    }),
  ),
  on(
    IDBActions.initIDB.loaded,
    (state: AppState, { intern, userSettings }): AppState => ({
      ...state,
      firstModalShown: intern.find((a) => a.name === 'firstModalShown')?.value ?? false,
      sidebarWidth: intern.find((a) => a.name === 'sidebarWidth')?.value,
      accessCode: userSettings.find((a) => a.name === 'accessCode')?.value,
      notification: userSettings.find((a) => a.name === 'notification')?.value ?? false,
    }),
  ),
  on(
    IDBActions.saveInternValues.success,
    (state: AppState, { items }): AppState => ({
      ...state,
      firstModalShown: items.find((a) => a.name === 'firstModalShown')?.value ?? state.firstModalShown,
      sidebarWidth: items.find((a) => a.name === 'sidebarWidth')?.value ?? state.sidebarWidth,
    }),
  ),
  on(
    IDBActions.initIDB.success,
    (state: AppState): AppState => ({
      ...state,
      idbInitialized: true,
    }),
  ),
  on(
    IDBActions.initIDB.success,
    (state: AppState): AppState => ({
      ...state,
      idbInitialized: true,
    }),
  ),
  on(
    AppActions.initVersionChecker.success,
    (state: AppState): AppState => ({
      ...state,
      versionCheckerStarted: true,
    }),
  ),
  on(
    ModeActions.initModes.success,
    (state: AppState): AppState => ({
      ...state,
      modesInitialized: true,
    }),
  ),
  on(
    AppActions.initConsoleLogger.success,
    (state: AppState): AppState => ({
      ...state,
      consoleLoggingInitialized: true,
    }),
  ),
  on(
    AppActions.loadSettings.success,
    (state: AppState, { configuration }): AppState => ({
      ...state,
      settings: configuration,
    }),
  ),
  on(
    ExternalInformationActions.updateASRQuotaInfo.success,
    (state: AppState, { asrQuotaInfo }): AppState => ({
      ...state,
      settings: {
        ...state.settings!,
        api: {
          ...state.settings!.api,
          services: state.settings!.api.services.map((service) => {
            const found = asrQuotaInfo.find((a) => a.asrName === service.provider);
            if (found) {
              return {
                ...service,
                usedQuota: found.usedQuota,
                quotaPerMonth: found.monthlyQuota,
              };
            }
            return service;
          }),
        },
      },
    }),
  ),
  on(
    ExternalInformationActions.updateASRInfo.success,
    (state: AppState, { asrInfos }): AppState => ({
      ...state,
      settings: {
        ...state.settings!,
        api: {
          ...state.settings!.api,
          services:
            state.settings?.api.services.map((service) => {
              if (service.basName && service.type !== 'Summarization') {
                const basInfo = asrInfos.find((a) => a.name === service.basName);
                if (basInfo !== undefined) {
                  return {
                    ...service,
                    dataStoragePolicy: basInfo.dataStoragePolicy ?? service.dataStoragePolicy,
                    maxSignalDuration: basInfo.maxSignalDuration ?? service.maxSignalDuration,
                    knownIssues: basInfo.knownIssues ?? service.knownIssues,
                    quotaPerMonth: basInfo.quotaPerMonth ?? service.quotaPerMonth,
                    termsURL: basInfo.termsURL ?? service.termsURL,
                  };
                }
              }
              return service;
            }) ?? [],
        },
      },
    }),
  ),
);
