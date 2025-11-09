import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { RootState } from '../app';
import { StoreItem, StoreItemTask } from '../store-item';
import { StoreItemActions } from '../store-item/store-item.actions';
import { selectAllTasks, selectCurrentModeEntries, selectDefaultOperations } from './mode.selectors';

@Injectable({ providedIn: 'root' })
export class ModeStoreService {
  store: Store<RootState> = inject(Store);
  selectedModeDefaultOperations$ = this.store.select(selectDefaultOperations);
  selectedModeEntries$ = this.store.select(selectCurrentModeEntries);
  allTasks$: Observable<StoreItemTask[] | undefined> = this.store.select(selectAllTasks);

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
}
