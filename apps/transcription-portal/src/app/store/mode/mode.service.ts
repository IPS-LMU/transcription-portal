import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { RootState } from '../app';
import { StoreTask, TaskActions } from '../task';
import { StoreTaskDirectory } from '../task-directory';
import { ModeActions } from './mode.actions';
import { selectAllTasks, selectCurrentModeEntries, selectDefaultOperations, selectSelectedRows } from './mode.selectors';

@Injectable({ providedIn: 'root' })
export class ModeStoreService {
  store: Store<RootState> = inject(Store);
  selectedModeDefaultOperations$ = this.store.select(selectDefaultOperations);
  selectedModeEntries$ = this.store.select(selectCurrentModeEntries);
  selectedRows$ = this.store.select(selectSelectedRows);
  allTasks$: Observable<StoreTask[] | undefined> = this.store.select(selectAllTasks);

  selectRows(rowIndexes: number[]) {
    this.store.dispatch(ModeActions.selectRows.do({ rowIndexes }));
  }

  deselectRows(rowIndexes: number[]) {
    this.store.dispatch(ModeActions.deselectRows.do({ rowIndexes }));
  }

  setSelectedRows(rowIndexes: number[]) {
    this.store.dispatch(ModeActions.setSelectedRows.do({ rowIndexes }));
  }

  removeTaskOrFolder(item: StoreTask | StoreTaskDirectory) {
    this.store.dispatch(TaskActions.removeTaskOrFolder.do({ item }));
  }
}
