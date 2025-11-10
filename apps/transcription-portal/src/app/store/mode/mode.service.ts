import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { RootState } from '../app';
import { StoreItem, StoreItemTask, StoreItemTaskOptions } from '../store-item';
import { StoreItemActions } from '../store-item/store-item.actions';
import { ModeActions } from './mode.actions';
import {
  selectAllCurrentTasks,
  selectAllTasks,
  selectCurrentMode,
  selectCurrentModeEntries,
  selectCurrentModeStatistics,
  selectDefaultOperations,
  selectDefaultOptions,
  selectOverallStatistics,
} from './mode.selectors';
import { DefaultUserSettings, TPortalModes } from './mode.state';

@Injectable({ providedIn: 'root' })
export class ModeStoreService {
  store: Store<RootState> = inject(Store);
  selectedModeDefaultOperations$ = this.store.select(selectDefaultOperations);
  selectedModeEntries$ = this.store.select(selectCurrentModeEntries);
  allTasks$: Observable<StoreItemTask[] | undefined> = this.store.select(selectAllTasks);
  defaultUserSettings$ = this.store.select(selectDefaultOptions);
  currentModeStatistics$ = this.store.select(selectCurrentModeStatistics);
  overallStatistics$ = this.store.select(selectOverallStatistics);
  allCurrentTasks$ = this.store.select(selectAllCurrentTasks);
  currentMode$ = this.store.select(selectCurrentMode);

  selectRows(rowIndexes: number[], deselectOthers = false) {
    this.store.dispatch(StoreItemActions.selectItems.do({ ids: rowIndexes, deselectOthers }));
  }

  deselectRows(rowIndexes: number[]) {
    this.store.dispatch(StoreItemActions.deselectItems.do({ ids: rowIndexes }));
  }

  setSelectedRows(rowIndexes: number[]) {
    this.store.dispatch(StoreItemActions.setSelectedItems.do({ ids: rowIndexes }));
  }

  removeTaskOrFolder(item: StoreItem) {
    this.store.dispatch(StoreItemActions.removeTaskOrFolder.do({ item }));
  }

  toggleDirectoryOpened(dirID: number) {
    this.store.dispatch(StoreItemActions.toggleTaskDirectoryOpened.do({ dirID }));
  }

  removeStoreItems(ids: number[]) {
    this.store.dispatch(StoreItemActions.removeStoreItems.do({ ids }));
  }

  setDefaultOperationEnabled(name: string, enabled: boolean) {
    this.store.dispatch(
      ModeActions.setDefaultOperationEnabled.do({
        name,
        enabled,
      }),
    );
  }

  changeMode(mode: TPortalModes) {
    this.store.dispatch(
      ModeActions.changeMode.do({
        mode,
      }),
    );
  }

  applyTaskOptionsOnQueuedTasks(options: StoreItemTaskOptions) {
    this.store.dispatch(
      StoreItemActions.changeProcessingOptionsForEachQueuedTask.do({
        options,
      }),
    );
  }

  setDefaultUserSettings(defaultUserSettings: DefaultUserSettings) {
    this.store.dispatch(ModeActions.setDefaultSettings.do({ defaultUserSettings }));
  }
}
