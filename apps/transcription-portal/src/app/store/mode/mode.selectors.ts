import { Dictionary } from '@ngrx/entity';
import { createSelector } from '@ngrx/store';
import { RootState } from '../app';
import { StoreTask } from '../task';
import { StoreTaskDirectory } from '../task-directory';
import { Mode } from './mode.state';

export const selectCurrentMode = (state: RootState): Mode<any> | undefined => state.modes.entities[state.modes.currentMode];
export const selectDefaultOperations = createSelector(selectCurrentMode, (mode) => mode?.defaultOperations);
export const selectCurrentModeEntries = createSelector(selectCurrentMode, (mode): (StoreTask | StoreTaskDirectory)[] =>
  Object.keys(mode?.items?.entities ?? []).map((a) => mode!.items!.entities[a]!),
);
export const selectSelectedRows = createSelector(selectCurrentMode, (mode) => mode?.selectedRows);
export const selectAllTasks = createSelector(selectCurrentMode, (mode) => {
  const mapItems = (itemID: string | number, entities: Dictionary<StoreTask | StoreTaskDirectory>): StoreTask[] => {
    const item = entities[itemID]!;

    if (item.type === 'task') {
      return [item];
    } else {
      return item.entries.ids.map((a: string | number) => mapItems(a, item.entries.entities)).flat();
    }
  };

  const t = mode?.items?.ids.map((id) => mapItems(id, mode!.items!.entities).flat()).flat();
  return t;
});
