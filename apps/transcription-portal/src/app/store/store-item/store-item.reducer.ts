import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { Mode, ModeState, TPortalModes } from '../mode';
import { ModeActions } from '../mode/mode.actions';
import { StoreTaskOperation } from '../operation';
import { getLastOperationResultFromLatestRound, getLastOperationRound } from '../operation/operation.functions';
import { StoreItem, StoreItemTask, TaskStatus } from './store-item';
import { StoreItemActions } from './store-item.actions';
import {
  applyFunctionOnStoreItemsWhereRecursive,
  applyFunctionOnStoreItemsWithIDsRecursive,
  changeTaskOperation,
  convertIDBTaskToStoreTask,
  getTaskItemsWhereRecursive,
  updateStatistics,
  updateTaskFilesWithSameFile,
} from './store-item.functions';
import { StoreItemsState } from './store-items-state';

export const getTaskReducers = (
  modeAdapter: EntityAdapter<Mode<any>>,
  taskAdapter: EntityAdapter<StoreItem>,
): ReducerTypes<ModeState, readonly ActionCreator[]>[] => [
  on(StoreItemActions.prepareTasks.do, (state: ModeState, { annotationTasks, summarizationTasks }) => {
    const tasks: Record<TPortalModes, StoreItem[]> = {
      annotation: annotationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter, state.entities['annotation']!.defaultOperations)),
      summarization: summarizationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter, state.entities['summarization']!.defaultOperations)),
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
      state = updateStatistics(state, id as TPortalModes);
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
  on(StoreItemActions.changeProcessingOptionsForEachQueuedTask.do, (state: ModeState, { options }): ModeState => {
    const currentMode = state.entities[state.currentMode]!;
    const defaultOperations = currentMode.defaultOperations;

    state = modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: applyFunctionOnStoreItemsWhereRecursive(
            (item) => item.status === TaskStatus.QUEUED,
            state.entities[state.currentMode]!.items,
            taskAdapter,
            (item, itemsState) => {
              return taskAdapter.updateOne(
                {
                  id: item.id,
                  changes: {
                    operations: defaultOperations.map((op, i) => op.factory.applyTaskOptions(options, item.operations![i])),
                    status: TaskStatus.PENDING,
                  },
                },
                itemsState,
              );
            },
          ),
        },
      },
      state,
    );

    state = updateStatistics(state, state.currentMode);
    return state;
  }),
  on(StoreItemActions.selectItems.do, (state: ModeState, { ids, deselectOthers }): ModeState => {
    return setSelection(ids, true, state, modeAdapter, taskAdapter, deselectOthers);
  }),
  on(StoreItemActions.deselectItems.do, (state: ModeState, { ids, deselectOthers }): ModeState => {
    return setSelection(ids, false, state, modeAdapter, taskAdapter, deselectOthers);
  }),
  on(StoreItemActions.startProcessing.do, (state: ModeState): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          overallState: 'processing',
          items: applyFunctionOnStoreItemsWhereRecursive(
            (item) => item.status === TaskStatus.ERROR,
            state.entities[state.currentMode]!.items,
            taskAdapter,
            (item, itemsState) => {
              return taskAdapter.updateOne(
                {
                  id: item.id,
                  changes: {
                    status: TaskStatus.PENDING,
                  },
                },
                itemsState,
              );
            },
          ),
        },
      },
      state,
    );
  }),
  on(
    StoreItemActions.stopProcessing.do,
    (state: ModeState): ModeState =>
      modeAdapter.updateOne(
        {
          id: state.currentMode,
          changes: {
            overallState: 'stopped',
          },
        },
        state,
      ),
  ),
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
                    const changedItem = {
                      ...(itemsState.entities[item.id]!.operations as StoreTaskOperation<any, any>[])[i],
                      rounds: [
                        ...itemsState.entities[item.id]!.operations![i].rounds.slice(0, lastRoundIndex),
                        {
                          ...itemsState.entities[item.id]!.operations![i].rounds![lastRoundIndex],
                          status: defaultOperation.enabled ? TaskStatus.PENDING : TaskStatus.SKIPPED,
                        },
                      ],
                      enabled: defaultOperation.enabled,
                    };

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
  // update statistics if task changes
  on(StoreItemActions.importItemsFromProcessingQueue.success, (state: ModeState, { mode }): ModeState => updateStatistics(state, mode)),
  on(StoreItemActions.processStoreItem.do, (state, { id, mode }) => {
    state = modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([id], state.entities[mode]!.items, taskAdapter, (item, itemsState) => {
            return taskAdapter.updateOne(
              {
                id: item.id,
                changes: {
                  status: TaskStatus.PROCESSING,
                },
              },
              itemsState,
            );
          }),
        },
      },
      state,
    );

    state = updateStatistics(state, mode);
    return state;
  }),
  on(StoreItemActions.changeOperation.do, StoreItemActions.processNextOperation.success, (state: ModeState, { taskID, operation, mode }) => {
    const taskItem = state.entities[mode]!.items.entities[taskID]!;
    let taskStatus = taskItem!.status;
    const lastRound = getLastOperationRound(operation);

    if (lastRound?.status === TaskStatus.ERROR) {
      taskStatus = TaskStatus.ERROR;
    } else if (lastRound?.status === TaskStatus.READY) {
      taskStatus = TaskStatus.READY;
    } else {
      if (getLastOperationRound(taskItem.operations![0])?.status === TaskStatus.PENDING) {
        // reuploading needed for upload
        taskStatus = TaskStatus.PENDING;
      } else {
        const allOperationsFinished = taskItem
          .operations!.filter((op) => op.enabled)
          .map((op) => getLastOperationRound(op)?.status === TaskStatus.FINISHED);
        if (allOperationsFinished) {
          taskStatus = TaskStatus.FINISHED;
        }
      }
    }

    state = modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([taskID], state.entities[mode]!.items, taskAdapter, (item, itemsState) =>
            taskAdapter.updateOne(
              {
                id: item.id,
                changes: {
                  status: taskStatus,
                  operations: state.entities![mode]!.items.entities![taskID]!.operations!.map((op) => {
                    if (op.id === operation.id) {
                      return operation;
                    }
                    return op;
                  }),
                },
              },
              itemsState,
            ),
          ),
        },
      },
      state,
    );

    state = updateStatistics(state, mode);
    return state;
  }),
  on(StoreItemActions.processNextOperation.fail, (state: ModeState, { taskID, mode, error, operationID }) => {
    state = modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([taskID], state.entities[mode]!.items, taskAdapter, (item, itemsState) =>
            taskAdapter.updateOne(
              {
                id: item.id,
                changes: {
                  operations: state.entities![mode]!.items.entities![taskID]!.operations!.map((op) => {
                    if (op.id === operationID) {
                      return { ...op, status: TaskStatus.ERROR, protocol: op.protocol + error + '<br/>' };
                    }
                    return op;
                  }),
                },
              },
              itemsState,
            ),
          ),
        },
      },
      state,
    );

    state = updateStatistics(state, mode);
    return state;
  }),
  on(StoreItemActions.reuploadFile.success, (state: ModeState, { mode, taskID, operationID, file, roundIndex }) => {
    const currentState = state.entities[state.currentMode]!;
    const task = currentState.items.entities[taskID]!;
    const taskOperations = task.operations!;
    const opIndex = taskOperations.findIndex((a) => a.id === operationID)!;
    const operation = taskOperations[opIndex];
    const previousOperation = opIndex > 0 ? taskOperations[opIndex - 1] : undefined;
    const previousOperationLastRound = previousOperation ? getLastOperationResultFromLatestRound(previousOperation) : undefined;

    if (
      operation.rounds.length > 0 &&
      !getLastOperationResultFromLatestRound(operation)?.online &&
      getLastOperationResultFromLatestRound(operation)?.available
    ) {
      // reupload result from tool operation
      return modeAdapter.updateOne(
        {
          id: mode,
          changes: {
            items: applyFunctionOnStoreItemsWithIDsRecursive([taskID], state.entities[mode]!.items, taskAdapter, (item, itemsState) => {
              return taskAdapter.updateOne(
                {
                  id: item.id,
                  changes: {
                    operations: itemsState.entities[item.id]!.operations!.map((op) => {
                      if (op.id === operationID) {
                        return {
                          ...op,
                          rounds: [
                            ...op.rounds.slice(0, op.rounds.length - 1),
                            {
                              ...getLastOperationRound(operation)!,
                              results: getLastOperationRound(operation)!.results.map((result) => {
                                if (result.name === file.name) {
                                  return {
                                    ...result,
                                    url: file.url,
                                    online: true,
                                  };
                                }

                                return result;
                              }),
                            },
                          ],
                        };
                      }

                      return op;
                    }),
                  },
                },
                itemsState,
              );
            }),
          },
        },
        state,
      );
    } else if (previousOperation && previousOperationLastRound?.online && previousOperationLastRound?.available) {
      return modeAdapter.updateOne(
        {
          id: mode,
          changes: {
            items: applyFunctionOnStoreItemsWithIDsRecursive([taskID], state.entities[mode]!.items, taskAdapter, (item, itemsState) => {
              return taskAdapter.updateOne(
                {
                  id: item.id,
                  changes: {
                    operations: itemsState.entities[item.id]!.operations!.map((op) => {
                      if (op.id === previousOperation.id) {
                        return {
                          ...op,
                          rounds: [
                            ...op.rounds.slice(0, op.rounds.length - 1),
                            {
                              ...getLastOperationRound(previousOperation)!,
                              results: getLastOperationRound(previousOperation)!.results.map((result) => {
                                if (result.name === file.name) {
                                  return {
                                    ...result,
                                    url: file.url,
                                    online: true,
                                  };
                                }

                                return result;
                              }),
                            },
                          ],
                        };
                      }

                      return op;
                    }),
                  },
                },
                itemsState,
              );
            }),
          },
        },
        state,
      );
    }

    return state;
  }),
  on(StoreItemActions.runOperationWithTool.success, (state: ModeState, { mode, taskID, operationID, url }) => {
    const task = getTaskItemsWhereRecursive((item) => item.id === taskID, state.entities[mode]!.items, taskAdapter)[0];
    const operationIndex = task.operations!.findIndex((a) => a.id === operationID);
    let operation = task.operations![operationIndex];
    const { factory } = state.entities[mode]!.defaultOperations[operationIndex];

    if (url !== '') {
      if (getLastOperationRound(operation)?.status === TaskStatus.FINISHED) {
        // start new round
        operation = {
          ...operation,
          rounds: [
            ...operation.rounds,
            {
              status: TaskStatus.PENDING,
              results: [],
            },
          ],
        };
      }
      operation = {
        ...operation,
        rounds: [
          ...operation.rounds.slice(0, operation.rounds.length - 1),
          {
            ...operation.rounds[operation.rounds.length - 1],
            status: TaskStatus.PROCESSING,
            time: {
              start: Date.now(),
            },
          },
        ],
      };

      state = modeAdapter.updateOne(
        {
          id: mode,
          changes: {
            items: {
              ...changeTaskOperation(
                taskID,
                operationID,
                () => {
                  return {
                    ...operation,
                  };
                },
                taskAdapter,
                state.entities[mode]!.items,
              ),
            },
            openedTool: {
              url: url!,
              operationID,
              taskID,
            },
          },
        },
        {
          ...state,
        },
      );
    } else {
      console.warn(`tool url is empty`);
    }

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
