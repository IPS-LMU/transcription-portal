import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { RootState } from '../app';

@Injectable({ providedIn: 'root' })
export class IDBStoreService {
  store: Store<RootState> = inject(Store);
}
