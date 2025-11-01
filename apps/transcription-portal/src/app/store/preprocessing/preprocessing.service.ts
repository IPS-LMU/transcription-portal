import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { DirectoryInfo, FileInfo } from '@octra/web-media';
import { Observable } from 'rxjs';
import { RootState } from '../app';
import { PreprocessingActions } from './preprocessing.actions';
import { selectPreprocessingQueue } from './preprocessing.selectors';
import { PreprocessingQueueItem } from './preprocessing.state';

@Injectable({ providedIn: 'root' })
export class PreprocessingStoreService {
  store: Store<RootState> = inject(Store);
  preprocessingQueue$: Observable<PreprocessingQueueItem[]> = this.store.select(selectPreprocessingQueue);

  addToQueue(infoItems: (FileInfo | DirectoryInfo<any>)[]) {
    this.store.dispatch(
      PreprocessingActions.addToQueue.do({
        infoItems,
      }),
    );
  }
}
