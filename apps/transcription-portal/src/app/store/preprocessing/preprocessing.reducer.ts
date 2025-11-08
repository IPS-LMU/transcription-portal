import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { Mode, ModeState } from '../mode';
import { StoreItemActions } from '../store-item/store-item.actions';
import { PreprocessingActions } from './preprocessing.actions';
import { PreprocessingQueueItem, ProcessingQueueStatus } from './preprocessing.state';

export const getPreprocessingReducers = (
  modeAdapter: EntityAdapter<Mode<any>>,
  preprocessingAdapter: EntityAdapter<PreprocessingQueueItem>,
): ReducerTypes<ModeState, readonly ActionCreator[]>[] => [
  on(PreprocessingActions.addToQueue.checkFiltered, (state: ModeState, { filteredItems, mode }) =>
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          preprocessor: preprocessingAdapter.addMany(
            filteredItems.map((infoItem, i) => ({
              id: state.counters.processingQueueItem + i,
              results: [],
              status: ProcessingQueueStatus.PENDING,
              infoItem,
            })),
            state.entities[state.currentMode]!.preprocessor,
          ),
          newFiles: true,
        },
      },
      {
        ...state,
        counters: {
          ...state.counters,
          processingQueueItem: state.counters.processingQueueItem + filteredItems.length,
        },
      },
    ),
  ),
  on(StoreItemActions.importItemsFromProcessingQueue.success, (state: ModeState, { mode, id }) =>
    // queue item successfully processed, set status to finished
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          preprocessor: preprocessingAdapter.removeOne(id, state.entities[mode]!.preprocessor),
        },
      },
      state,
    ),
  ),
];

// TODO 2. add queue item results to tasks table with correct ids
// TODO 2.1. check for queued tasks with same files (hash)
// TODO 2.2. check for queued tasks if split needed
