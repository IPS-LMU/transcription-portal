import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { Mode, ModeState } from '../mode';
import { StoreItem, StoreItemTaskDirectory } from './store-item';
import { StoreItemActions } from './store-item.actions';
import { convertIDBTaskToStoreTask, updateTaskFilesWithSameFile } from './store-item.functions';
import { StoreItemsState } from './store-items-state';

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
  on(StoreItemActions.removeStoreItems.do, (state: ModeState, { ids }): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: removeStoreItemsWithIDs(ids, state.entities[state.currentMode]!.items, taskAdapter),
        },
      },
      state,
    );
  }),
  on(StoreItemActions.importItemsFromProcessingQueue.do, (state: ModeState, { results, mode }) => {
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

function removeStoreItemsWithIDs(ids: number[], itemsState: StoreItemsState, taskAdapter: EntityAdapter<StoreItem>) {
  const items = itemsState.ids.map((id) => itemsState.entities[id]).filter((a) => a !== undefined);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const idIndex = ids.findIndex((a) => a === item.id);

    if (idIndex > -1) {
      itemsState = taskAdapter.removeOne(item.id, itemsState);
      ids = [...ids.slice(0, idIndex), ...ids.slice(idIndex + 1)];
      items.splice(i, 1);
      i--;
    } else if (item.type === 'folder') {
      const folderState = removeStoreItemsWithIDs(ids, item.entries!, taskAdapter);
      itemsState = taskAdapter.updateOne(
        {
          id: item.id,
          changes: {
            entries: folderState,
          },
        },
        itemsState,
      );


      if (folderState.ids.length === 1) {
        // only one remaining, remove dir
        const id = folderState.ids[0]!;
        const subsubItem = folderState.entities[id]!;

        itemsState = taskAdapter.addOne(
          {
            ...subsubItem,
            directoryID: undefined,
          },
          itemsState,
        );
        itemsState = taskAdapter.removeOne(item.id, itemsState);
      }
    }
  }

  return itemsState;
}
