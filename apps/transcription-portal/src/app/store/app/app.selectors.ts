import { RootState } from './app.reducer';

export const selectAppInitialized = (state: RootState) => state.app.initialized;
