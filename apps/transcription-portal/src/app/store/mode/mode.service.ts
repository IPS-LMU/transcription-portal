import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { RootState } from '../app';
import { selectCurrentModeEntries, selectDefaultOperations, selectSelectedRows } from './mode.selectors';
import { ModeActions } from './mode.actions';

@Injectable({ providedIn: 'root' })
export class ModeStoreService {
  store: Store<RootState> = inject(Store);
  selectedModeDefaultOperations$ = this.store.select(selectDefaultOperations);
  selectedModeEntries$ = this.store.select(selectCurrentModeEntries);
  selectedRows$ = this.store.select(selectSelectedRows);

  selectRows(rowIndexes: number[]){
    this.store.dispatch(ModeActions.selectRows.do({rowIndexes}));
  }

  deselectRows(rowIndexes: number[]){
    this.store.dispatch(ModeActions.deselectRows.do({rowIndexes}));
  }

  setSelectedRows(rowIndexes: number[]){
    this.store.dispatch(ModeActions.setSelectedRows.do({rowIndexes}));
  }
}
