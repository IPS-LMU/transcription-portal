import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { RootState } from '../app';
import { StoreItem, StoreItemTask, StoreItemTaskDirectory, StoreItemActions } from '../store-item';
import { selectAllTasks, selectCurrentModeEntries, selectDefaultOperations } from './mode.selectors';

@Injectable({ providedIn: 'root' })
export class ModeStoreService {
  store: Store<RootState> = inject(Store);
  selectedModeDefaultOperations$ = this.store.select(selectDefaultOperations);
  selectedModeEntries$ = this.store.select(selectCurrentModeEntries);
  allTasks$: Observable<StoreItemTask[] | undefined> = this.store.select(selectAllTasks);

  selectRows(rowIndexes: number[]) {
    this.store.dispatch(StoreItemActions.selectItems.do({ ids: rowIndexes }));
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
}
