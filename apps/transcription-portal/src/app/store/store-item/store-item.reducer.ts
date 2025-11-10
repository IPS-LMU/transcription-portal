import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { TaskStatus } from '../../obj/tasks';
import { Mode, ModeState } from '../mode';
import { ModeActions } from '../mode/mode.actions';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { StoreItem, StoreItemTask, StoreItemTaskDirectory } from './store-item';
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
      annotation: annotationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter, state.entities['annotation']!.defaultOperations)),
      summarization: summarizationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter, state.entities['annotation']!.defaultOperations)),
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
  on(ModeActions.setDefaultOperationEnabled.success, (state: ModeState, { defaultOptions }) => ({
    ...modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: applyFunctionOnStoreItemsWhereRecursive(
            (item) => item.status === TaskStatus.QUEUED,
            state.entities[state.currentMode]!.items,
            taskAdapter,
            (item, itemsState) => {
              if (item.type === 'task') {
                const task = item as StoreItemTask;
                for (let i = 0; i < state.entities[state.currentMode]!.defaultOperations.length; i++) {
                  const defaultOperation = state.entities[state.currentMode]!.defaultOperations[i];
                  const lastRoundIndex = itemsState.entities[item.id]!.operations![i].rounds.length - 1;

                  if (lastRoundIndex > -1) {
                    const changedItem = itemsState.entities[item.id]!.operations![i].duplicate({
                      ...(itemsState.entities[item.id]!.operations as StoreTaskOperation<any, any>[])[i],
                      rounds: [
                        ...itemsState.entities[item.id]!.operations![i].rounds.slice(0, lastRoundIndex),
                        new StoreTaskOperationProcessingRound({
                          ...itemsState.entities[item.id]!.operations![i].rounds![lastRoundIndex],
                          status: defaultOperation.enabled ? TaskStatus.PENDING : TaskStatus.SKIPPED,
                        }),
                      ],
                      enabled: defaultOperation.enabled,
                    });

                    itemsState = taskAdapter.updateOne(
                      {
                        id: item.id,
                        changes: {
                          operations: [
                            ...itemsState.entities[item.id]!.operations!.slice(0, i),
                            changedItem,
                            ...itemsState.entities[item.id]!.operations!.slice(i + 1),
                          ],
                        },
                      },
                      itemsState,
                    );
                  }
                }
              }
              return itemsState;
            },
          ),
        },
      },
      state,
    ),
  })),
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

function applyFunctionOnStoreItemsWhereRecursive(
  where: (item: StoreItem) => boolean,
  itemsState: StoreItemsState,
  taskAdapter: EntityAdapter<StoreItem>,
  applyFunction: (item: StoreItem, itemsState: StoreItemsState) => StoreItemsState,
  afterAppliedOnFolder?: (item: StoreItemTaskDirectory, itemsState: StoreItemsState, folderItemsState: StoreItemsState) => StoreItemsState,
) {
  const items = itemsState.ids.map((id) => itemsState.entities[id]).filter((a) => a !== undefined);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (where(item)) {
      itemsState = applyFunction(item, itemsState);
      items.splice(i, 1);
      i--;
    } else if (item.type === 'folder') {
      const folderState = applyFunctionOnStoreItemsWhereRecursive(where, item.entries!, taskAdapter, applyFunction);
      itemsState = taskAdapter.updateOne(
        {
          id: item.id,
          changes: {
            entries: folderState,
          },
        },
        itemsState,
      );

      if (afterAppliedOnFolder) {
        itemsState = afterAppliedOnFolder(item as StoreItemTaskDirectory, itemsState, folderState);
      }
    }
  }

  return itemsState;
}

function applyFunctionOnStoreItemsWithIDsRecursive(
  ids: number[],
  itemsState: StoreItemsState,
  taskAdapter: EntityAdapter<StoreItem>,
  applyFunction: (item: StoreItem, itemsState: StoreItemsState) => StoreItemsState,
  afterAppliedOnFolder?: (item: StoreItemTaskDirectory, itemsState: StoreItemsState, folderItemsState: StoreItemsState) => StoreItemsState,
) {
  const items = itemsState.ids.map((id) => itemsState.entities[id]).filter((a) => a !== undefined);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const idIndex = ids.findIndex((a) => a === item.id);

    if (idIndex > -1) {
      itemsState = applyFunction(item, itemsState);
      ids = [...ids.slice(0, idIndex), ...ids.slice(idIndex + 1)];
      items.splice(i, 1);
      i--;
    } else if (item.type === 'folder') {
      const folderState = applyFunctionOnStoreItemsWithIDsRecursive(ids, item.entries!, taskAdapter, applyFunction);
      itemsState = taskAdapter.updateOne(
        {
          id: item.id,
          changes: {
            entries: folderState,
          },
        },
        itemsState,
      );

      if (afterAppliedOnFolder) {
        itemsState = afterAppliedOnFolder(item as StoreItemTaskDirectory, itemsState, folderState);
      }
    }
  }

  return itemsState;
}

function removeStoreItemsWithIDs(ids: number[], itemsState: StoreItemsState, taskAdapter: EntityAdapter<StoreItem>) {
  return applyFunctionOnStoreItemsWithIDsRecursive(
    ids,
    itemsState,
    taskAdapter,
    (item, itemsState) => {
      return taskAdapter.removeOne(item.id, itemsState);
    },
    (item, itemsState, folderItemsState) => {
      if (folderItemsState.ids.length === 1) {
        // only one remaining, remove dir
        const id = folderItemsState.ids[0]!;
        const subsubItem = folderItemsState.entities[id]!;

        itemsState = taskAdapter.addOne(
          {
            ...subsubItem,
            directoryID: undefined,
          },
          itemsState,
        );
        return taskAdapter.removeOne(item.id, itemsState);
      }
      return itemsState;
    },
  );
}
