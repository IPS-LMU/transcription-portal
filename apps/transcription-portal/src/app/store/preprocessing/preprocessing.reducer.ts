import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { Mode, ModeState } from '../mode';
import { PreprocessingActions } from './preprocessing.actions';
import { PreprocessingQueueItem, ProcessingQueueStatus } from './preprocessing.state';

export const getPreprocessingReducers = (
  modeAdapter: EntityAdapter<Mode<any>>,
  preprocessingAdapter: EntityAdapter<PreprocessingQueueItem>,
): ReducerTypes<ModeState, readonly ActionCreator[]>[] => [
  on(PreprocessingActions.addToQueue.do, (state: ModeState, { infoItems }) =>
    modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          preprocessor: preprocessingAdapter.addMany(
            infoItems.map((infoItem, i) => ({
              id: state.counters.processingQueueItem + i,
              results: [],
              status: ProcessingQueueStatus.PENDING,
              infoItem,
            })),
            state.entities[state.currentMode]!.preprocessor,
          ),
        },
      },
      {
        ...state,
        counters: {
          ...state.counters,
          processingQueueItem: state.counters.processingQueueItem + infoItems.length,
        },
      },
    ),
  ),
];
