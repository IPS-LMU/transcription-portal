import { Dictionary } from '@ngrx/entity';
import { createSelector } from '@ngrx/store';
import { RootState } from '../app';
import { StoreItem, StoreItemTask, StoreItemTaskDirectory } from '../store-item';
import { Mode } from './mode.state';

export const selectCurrentMode = (state: RootState): Mode<any> | undefined => {
  return state.modes.entities[state.modes.currentMode];
};
export const selectDefaultOperations = createSelector(selectCurrentMode, (mode) => mode?.defaultOperations);
export const selectCurrentModeEntries = createSelector(selectCurrentMode, (mode): StoreItem[] =>
  Object.keys(mode?.items?.entities ?? []).map((a) => mode!.items!.entities[a]!),
);
export const selectAllTasks = createSelector(selectCurrentMode, (mode) => {
  const mapItems = (itemID: string | number, entities: Dictionary<StoreItem>): StoreItemTask[] => {
    const item = entities[itemID]!;

    if (item.type === 'task') {
      return [item as StoreItemTask];
    } else {
      const dir = item as StoreItemTaskDirectory;
      return dir.entries.ids.map((a: string | number) => mapItems(a, dir.entries.entities)).flat();
    }
  };

  const t = mode?.items?.ids.map((id) => mapItems(id, mode!.items!.entities).flat()).flat();
  return t;
});
