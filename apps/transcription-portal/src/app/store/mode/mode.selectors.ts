import { Dictionary } from '@ngrx/entity';
import { createSelector } from '@ngrx/store';
import { RootState } from '../app';
import { StoreItem, StoreItemTask, StoreItemTaskDirectory } from '../store-item';
import { getAllTasks } from './mode.functions';
import { Mode, ModeStatistics } from './mode.state';

export const selectCurrentModeState = (state: RootState): Mode<any> | undefined => {
  return state.modes.entities[state.modes.currentMode];
};
export const selectDefaultOptions = (state: RootState) => state.modes.defaultUserSettings;
export const selectCurrentMode = (state: RootState) => state.modes.currentMode;
export const selectOverallStatistics = (state: RootState) => {
  const modes = state.modes.ids;
  const statistics: ModeStatistics = { errors: 0, finished: 0, queued: 0, running: 0, waiting: 0 };

  for (const mode of modes) {
    statistics.errors += state.modes.entities[mode]!.statistics.errors;
    statistics.finished += state.modes.entities[mode]!.statistics.finished;
    statistics.queued += state.modes.entities[mode]!.statistics.queued;
    statistics.running += state.modes.entities[mode]!.statistics.running;
    statistics.waiting += state.modes.entities[mode]!.statistics.waiting;
  }

  return statistics;
};
export const selectCurrentModeStatistics = createSelector(selectCurrentModeState, (mode) => mode!.statistics);
export const selectDefaultOperations = createSelector(selectCurrentModeState, (mode) => mode?.defaultOperations);
export const selectCurrentModeEntries = createSelector(selectCurrentModeState, (mode): StoreItem[] =>
  Object.keys(mode?.items?.entities ?? []).map((a) => mode!.items!.entities[a]!),
);
export const selectAllCurrentTasks = createSelector(selectCurrentModeState, (mode): StoreItemTask[] => (mode?.items ? getAllTasks(mode.items) : []));
export const selectAllTasks = createSelector(selectCurrentModeState, (mode) => {
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
