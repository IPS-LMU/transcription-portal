import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { Mode, ModeState } from '../mode';
import { StoreItem } from './store-item';
import { StoreItemActions } from './store-item.actions';
import { convertIDBTaskToStoreTask, updateTaskFilesWithSameFile } from './store-item.functions';

export const getTaskReducers = (
  modeAdapter: EntityAdapter<Mode<any>>,
  taskAdapter: EntityAdapter<StoreItem>,
): ReducerTypes<ModeState, readonly ActionCreator[]>[] => [
  on(StoreItemActions.prepareTasks.do, (state: ModeState, { annotationTasks, summarizationTasks }) => {
    const tasks: {
      annotation: StoreItem[];
      summarization: StoreItem[];
    } = {
      annotation: annotationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter)),
      summarization: summarizationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter)),
    };

    for (const id of Object.keys(tasks)) {
      state = modeAdapter.updateOne(
        {
          id,
          changes: {
            items: taskAdapter.addMany((tasks as never)[id], state.entities[id]!.items),
          },
        },
        state,
      );
    }

    return state;
  }),
  on(StoreItemActions.removeTaskOrFolder.do, (state: ModeState, { item }) => {
    const removedItemsState = taskAdapter.removeOne(item.id, state.entities[state.currentMode]!.items);

    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: taskAdapter.updateMany(
            removedItemsState.ids
              .filter((a) => a !== undefined)
              .map((id) => ({
                id: id as number,
                changes: {
                  selected: false,
                },
              })),
            removedItemsState,
          ),
        },
      },
      state,
    );
  }),
  on(StoreItemActions.selectItems.do, (state: ModeState, { ids, deselectOthers }): ModeState => {
    return setSelection(ids, true, state, modeAdapter, taskAdapter, deselectOthers);
  }),
  on(StoreItemActions.deselectItems.do, (state: ModeState, { ids, deselectOthers }): ModeState => {
    return setSelection(ids, false, state, modeAdapter, taskAdapter, deselectOthers);
  }),
  on(StoreItemActions.setSelectedItems.do, (state: ModeState, { ids }): ModeState => {
    return setSelection(ids, true, state, modeAdapter, taskAdapter, true);
  }),
  on(StoreItemActions.importItemsFromProcessingQueue.do, (state: ModeState, { id, results, mode }) => {
    const currentMode = state.entities![mode]!;

    for (const result of results) {
      const itemChange = updateTaskFilesWithSameFile(
        result,
        state.entities[mode]!.items,
        taskAdapter,
        state.counters,
        currentMode.defaultOperations,
        currentMode.options,
      );
      state = modeAdapter.updateOne(
        {
          id: mode,
          changes: {
            items: itemChange.state,
          },
        },
        {
          ...state,
          counters: itemChange.counters,
        },
      );
    }

    return state;
  }),
  on(StoreItemActions.toggleTaskDirectoryOpened.do, (state: ModeState, { dirID }) => {
    const t = "";
    state = modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: taskAdapter.updateOne(
            {
              id: dirID,
              changes: {
                opened: !(state.entities[state.currentMode]?.items.entities[dirID]?.opened ?? false),
              },
            },
            state.entities[state.currentMode]!.items,
          ),
        },
      },
      state,
    );

    return state;
  }),
];

function setSelection(
  ids: number[],
  selected: boolean,
  state: ModeState,
  modeAdapter: EntityAdapter<Mode<any>>,
  taskAdapter: EntityAdapter<StoreItem>,
  deselectOthers?: boolean,
) {
  const itemsState = !deselectOthers
    ? state.entities[state.currentMode]!.items
    : taskAdapter.updateMany(
        state.entities[state.currentMode]!.items.ids.map((id) => ({
          id: id as number,
          changes: {
            selected: false,
          },
        })),
        state.entities[state.currentMode]!.items,
      );

  return modeAdapter.updateOne(
    {
      id: state.currentMode,
      changes: {
        items: taskAdapter.updateMany(
          ids.map((id) => ({
            id: id as number,
            changes: {
              selected,
            },
          })),
          itemsState,
        ),
      },
    },
    state,
  );
}
