import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { RootState } from '../app';
import { IDBActions } from './idb.actions';

@Injectable({ providedIn: 'root' })
export class IDBStoreService {
  store: Store<RootState> = inject(Store);

  clearDatabase() {
    this.store.dispatch(IDBActions.clearDatabase.do());
  }

  backupDatabase() {
    this.store.dispatch(IDBActions.backupDatabase.do());
  }

  restoreDatabase(blob: Blob) {
    this.store.dispatch(
      IDBActions.restoreDatabase.do({
        blob,
      }),
    );
  }

  revokeDatabaseBackupURL() {
    this.store.dispatch(IDBActions.backupDatabase.revoke());
  }
}
