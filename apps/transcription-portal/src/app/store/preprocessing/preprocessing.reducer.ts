import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { TPortalAudioInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { Mode, ModeState } from '../mode';
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
  on(PreprocessingActions.processQueueItem.success, (state: ModeState, { mode, id, results }) =>
    // queue item successfully processed, set status to finished
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          preprocessor: preprocessingAdapter.updateOne(
            {
              id,
              changes: {
                status: results.find((a) => a.type !== 'folder' && (a as TPortalFileInfo).isMediaFile() && (a as TPortalAudioInfo).channels > 1)
                  ? ProcessingQueueStatus.WAIT_FOR_SPLIT
                  : ProcessingQueueStatus.FINISHED,
                results,
                infoItem: {
                  ...state.entities[mode]!.preprocessor.entities[id]!.infoItem,
                  blob: undefined, // remove info item so save memory
                },
              },
            },
            state.entities[mode]!.preprocessor,
          ),
        },
      },
      state,
    ),
  ),
];

// TODO 2. add queue item results to tasks table with correct ids
// TODO 2.1. check for queued tasks with same files (hash)
// TODO 2.2. check for queued tasks if split needed
