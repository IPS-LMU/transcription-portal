import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { Mode, ModeState } from '../mode';
import { StoreAudioFile } from '../store-item';
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
                status: results.find((a) => a.type.includes('audio') && (a as StoreAudioFile).channels > 1)
                  ? state.entities[mode]!.preprocessor.splitType
                    ? ProcessingQueueStatus.NEEDS_SPLIT
                    : ProcessingQueueStatus.WAIT_FOR_SPLIT
                  : ProcessingQueueStatus.FINISHED,
                infoItem: results.find((a) => a.type.includes('audio') && (a as StoreAudioFile).channels > 1)
                  ? {
                      ...results[0],
                      name: results[0].attributes.originalFileName,
                    }
                  : state.entities[mode]!.preprocessor.entities[id]!.infoItem,
              },
            },
            state.entities[mode]!.preprocessor,
          ),
        },
      },
      state,
    ),
  ),
  on(PreprocessingActions.splitFiles.do, (state: ModeState, { mode, queueItemID }) =>
    // queue item successfully processed, set status to finished
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          preprocessor: preprocessingAdapter.updateOne(
            {
              id: queueItemID,
              changes: {
                status: ProcessingQueueStatus.PROCESSING,
              },
            },
            state.entities[mode]!.preprocessor,
          ),
        },
      },
      state,
    ),
  ),
  on(PreprocessingActions.splitFiles.success, (state: ModeState, { mode, queueItemID, results }) => {
    let preprocessingState = preprocessingAdapter.removeOne(queueItemID, state.entities[mode]!.preprocessor);

    preprocessingState = preprocessingAdapter.addMany(
      results.map((result, i) => ({
        status: ProcessingQueueStatus.PENDING,
        id: state.counters.processingQueueItem + i,
        results: [],
        infoItem: result,
      })),
      preprocessingState,
    );

    return modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          preprocessor: preprocessingState,
        },
      },
      {
        ...state,
        counters: {
          ...state.counters,
          queueItemID: state.counters.processingQueueItem + results.length,
        },
      },
    );
  }),
  on(PreprocessingActions.showSplitModal.do, (state: ModeState, { mode }) =>
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          preprocessor: {
            ...state.entities[mode]!.preprocessor,
            splitModalVisible: true,
          },
        },
      },
      state,
    ),
  ),
  on(PreprocessingActions.setSplitType.do, (state: ModeState, { mode, splitType }) =>
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          preprocessor: preprocessingAdapter.updateMany(
            state.entities[mode]!.preprocessor.ids.map((id) => state.entities[mode]!.preprocessor.entities[id])
              .filter((a) => a !== undefined)
              .map((item) => ({
                id: item.id,
                changes: {
                  status: item.status === ProcessingQueueStatus.WAIT_FOR_SPLIT ? ProcessingQueueStatus.NEEDS_SPLIT : item.status,
                },
              })),
            {
              ...state.entities[mode]!.preprocessor,
              splitModalVisible: false,
              splitType,
            },
          ),
        },
      },
      state,
    ),
  ),
];

// TODO 2.2. check for queued tasks if split needed
