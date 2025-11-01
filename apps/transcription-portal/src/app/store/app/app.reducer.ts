import { createReducer, on } from '@ngrx/store';
import { OHConfiguration } from '../../obj/oh-config';
import { ModeActions, ModeState } from '../mode';
import { AppActions } from './app.actions';

export interface AppState {
  versionCheckerStarted: boolean;
  modesInitialized: boolean;
  consoleLoggingInitialized: boolean;
  settings?: OHConfiguration;
}

export const InitialAppState: AppState = {
  versionCheckerStarted: false,
  modesInitialized: false,
  consoleLoggingInitialized: false,
};

export interface RootState {
  app: AppState;
  modes: ModeState;
}

export const appReducer = createReducer(
  InitialAppState,
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
);
