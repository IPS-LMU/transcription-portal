import { createSelector } from '@ngrx/store';
import { RootState } from '../app';
import { StoreTask } from '../task';
import { StoreTaskDirectory } from '../task-directory';
import { Mode } from './mode.state';

export const selectCurrentMode = (state: RootState): Mode<any> | undefined => state.modes.entities[state.modes.currentMode];
export const selectDefaultOperations = createSelector(selectCurrentMode, (mode) => mode?.defaultOperations);
export const selectCurrentModeEntries = createSelector(selectCurrentMode, (mode): (StoreTask | StoreTaskDirectory)[] =>
  Object.keys(mode?.tasks?.entities ?? []).map((a) => mode!.tasks!.entities[a]!),
);
export const selectSelectedRows = createSelector(selectCurrentMode, (mode) => mode?.selectedRows);
