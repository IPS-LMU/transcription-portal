import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { Mode } from './mode.state';
import { StoreItem } from '../store-item';
import { PreprocessingQueueItem } from '../preprocessing';

export const modeAdapter: EntityAdapter<Mode<any>> = createEntityAdapter<Mode<any>>({
  selectId: (mode) => mode.name,
  sortComparer: (a: Mode<any>, b: Mode<any>) => {
    return a.name.localeCompare(b.name);
  },
});

export const taskAdapter: EntityAdapter<StoreItem> = createEntityAdapter<StoreItem>({
  selectId: (task) => task.id,
});

export const preprocessingAdapter: EntityAdapter<PreprocessingQueueItem> = createEntityAdapter<PreprocessingQueueItem>({
  selectId: (item) => item.id,
});
