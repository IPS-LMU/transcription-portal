import { RootState } from './app.reducer';

export const selectAppInitialized = (state: RootState) => state.app.initialized;
export const selectAppSettings = (state: RootState) => state.app.settings;
export const selectAvailableLanguages = (state: RootState) => state.app.availableLanguages;
export const selectAccessCode = (state: RootState) => state.app.accessCode;
export const selectIDBBackup = (state: RootState) => state.app.idbBackup;
export const selectFeedbackEnabled = (state: RootState) => state.app.feedbackEnabled;
export const selectUserProfile = (state: RootState) => state.app.userProfile;
