import { createSelector } from '@ngrx/store';
import { Mode, selectCurrentMode } from '../mode';
import { PreprocessingState } from './preprocessing.state';

export const selectPreprocessor = createSelector(
  selectCurrentMode,
  (state: Mode<any> | undefined): PreprocessingState | undefined => {
    return state?.preprocessor;
  },
);
export const selectPreprocessingQueue = createSelector(selectPreprocessor, (preprocessor) =>
  preprocessor?.entities
    ? Object.keys(preprocessor.entities)
        .map((id) => preprocessor.entities[id])
        .filter((a) => a !== undefined)
    : [],
);
