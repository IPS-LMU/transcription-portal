import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { RootState } from '../app';
import { PreprocessingActions } from './preprocessing.actions';
import { selectPreprocessingQueue } from './preprocessing.selectors';
import { Observable } from 'rxjs';
import { PreprocessingQueueItem } from './preprocessing.state';

@Injectable({ providedIn: 'root' })
export class PreprocessingStoreService {
  store: Store<RootState> = inject(Store);
  preprocessingQueue$: Observable<PreprocessingQueueItem[]> = this.store.select(selectPreprocessingQueue);

  addToQueue(infoItems: (TPortalFileInfo | TPortalDirectoryInfo)[]) {
    this.store.dispatch(
      PreprocessingActions.addToQueue.do({
        infoItems,
      }),
    );
  }
}
