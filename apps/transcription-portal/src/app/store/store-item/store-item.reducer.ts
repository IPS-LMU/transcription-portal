import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { last } from '@octra/utilities';
import { Mode, ModeState, TPortalModes } from '../mode';
import { ModeActions } from '../mode/mode.actions';
import { OperationFactory, StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { addProcessingRound, getLastOperationRound, parseProtocol } from '../operation/operation.functions';
import { StoreFile, StoreItem, StoreItemTask, StoreItemTaskDirectory, TaskStatus } from './store-item';
import { StoreItemActions } from './store-item.actions';
import {
  applyFunctionOnStoreItemsWhereRecursive,
  applyFunctionOnStoreItemsWithIDsRecursive,
  changeTaskOperation,
  convertIDBTaskToStoreTask,
  getOneTaskItemWhereRecursive,
  getStoreItemsWhereRecursive,
  updateStatistics,
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

    const prepareItem: (item: StoreItem, taskAdapter: EntityAdapter<StoreItem>) => StoreItem = (
      item: StoreItem,
      taskAdapter: EntityAdapter<StoreItem>,
    ) => {
      if (item.type === 'task') {
        let lastEnabledOP: StoreTaskOperationProcessingRound | undefined = undefined;

        for (let i = 0; i < item.operations!.length; i++) {
          const operation = item.operations![i];
          const opLastRound = getLastOperationRound(operation);

          // FIX PENDING to READY for tool operations
          if (lastEnabledOP?.status === 'FINISHED' && opLastRound?.status === 'PENDING' && ['Emu WebApp', 'OCTRA'].includes(operation.name)) {
            item = {
              ...item,
              operations: [
                ...item.operations!.slice(0, i),
                {
                  ...operation,
                  rounds: [
                    ...operation.rounds.slice(0, operation.rounds.length - 1),
                    {
                      ...opLastRound,
                      status: TaskStatus.READY,
                    },
                  ],
                },
                ...item.operations!.slice(i + 1),
              ],
              status: TaskStatus.READY,
            };
          }

          if (operation.enabled) {
            lastEnabledOP = getLastOperationRound(operation);
          }
        }

        // replace task files with uploaded files
        item.files = item.files?.map((file) => {
          const found = getLastOperationRound(item.operations![0])?.results.find((a) => a.name === file.name);
          if (found) {
            return {
              ...file,
              url: found.url,
              online: found.online,
              content: found?.content ?? file.content,
            };
          }
          return file;
        });

        if (item.status !== TaskStatus.QUEUED) {
          const operationStatus: TaskStatus[] = item.operations!.map((op) => getLastOperationRound(op)!.status);

          if (operationStatus.includes(TaskStatus.READY)) {
            item = {
              ...item,
              status: TaskStatus.READY,
            };
          } else if (operationStatus.includes(TaskStatus.ERROR)) {
            item = {
              ...item,
              status: TaskStatus.ERROR,
            };
          } else if (operationStatus.includes(TaskStatus.PROCESSING)) {
            item = {
              ...item,
              status: TaskStatus.PENDING,
            };
          } else if (operationStatus.includes(TaskStatus.PENDING)) {
            item = {
              ...item,
              status: TaskStatus.PENDING,
            };
          } else if (operationStatus.filter((a) => ![TaskStatus.FINISHED, TaskStatus.SKIPPED].includes(a)).length === 0) {
            item = {
              ...item,
              status: TaskStatus.FINISHED,
            };
          }
        }

        return item;
      } else {
        return {
          ...(item as StoreItem),
          entries: applyFunctionOnStoreItemsWhereRecursive(
            () => {
              return true;
            },
            (item as StoreItemTaskDirectory).entries,
            taskAdapter,
            (item, itemsState) => {
              return taskAdapter.updateOne(
                {
                  id: item.id,
                  changes: prepareItem(item, taskAdapter),
                },
                itemsState,
              );
            },
          ),
        };
      }
    };

    const storeItemIDs: number[] = [];
    const operationIDs: number[] = [];

    const getIDs = (item: StoreItem) => {
      if (item.type === 'task') {
        const task = item as StoreItemTask;

        return {
          operations: task.operations.map((op) => op.id),
          items: [item.id],
        };
      } else {
        const result: {
          operations: number[];
          items: number[];
        } = {
          operations: [],
          items: [],
        };

        const dir = item as StoreItemTaskDirectory;

        for (const id of dir.entries.ids) {
          const entry = dir.entries.entities[id]!;
          const entryResult = getIDs(entry);
          result.operations.push(...entryResult.operations);
          result.items.push(...entryResult.items);
        }

        return result;
      }
    };

    for (const id of Object.keys(tasks)) {
      const items: StoreItem[] = (tasks as any)[id].map((item: StoreItem) => prepareItem(item, taskAdapter));
      for (const item of items) {
        const ids = getIDs(item);
        storeItemIDs.push(...ids.items);
        operationIDs.push(...ids.operations);
      }

      state = modeAdapter.updateOne(
        {
          id,
          changes: {
            items: taskAdapter.addMany(items, state.entities[id]!.items),
          },
        },
        state,
      );
      state = {
        ...updateStatistics(state, id as TPortalModes),
        counters: {
          ...state.counters,
          operation: Math.max(0, ...operationIDs) + 1,
          storeItem: Math.max(0, ...storeItemIDs) + 1,
        },
      };
    }

    return state;
  }),
  on(StoreItemActions.removeTaskOrFolder.do, (state: ModeState, { item }) => {
    const removedItemsState = taskAdapter.removeOne(item.id, state.entities[state.currentMode]!.items);

    state = modeAdapter.updateOne(
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

    state = updateStatistics(state, state.currentMode!);
    return state;
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
              if (item.type === 'task') {
                return taskAdapter.updateOne(
                  {
                    id: item.id,
                    changes: {
                      operations: defaultOperations.map((op, i) => op.factory.applyTaskOptions(options, item.operations![i])),
                    },
                  },
                  itemsState,
                );
              }
              return itemsState;
            },
          ),
        },
      },
      state,
    );

    state = updateStatistics(state, state.currentMode);
    return state;
  }),
  on(StoreItemActions.markValidQueuedTasksAsPending.success, (state: ModeState) => {
    state = modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: applyFunctionOnStoreItemsWhereRecursive(
            (item) => item.status === TaskStatus.QUEUED && !item.invalid,
            state.entities![state.currentMode]!.items,
            taskAdapter,
            (item, itemsState) => {
              if (item.type === 'task') {
                return taskAdapter.updateOne(
                  {
                    id: item.id,
                    changes: {
                      status: TaskStatus.PENDING,
                    },
                  },
                  itemsState,
                );
              }
              return itemsState;
            },
          ),
        },
      },
      state,
    );
    state = updateStatistics(state, state.currentMode);
    return state;
  }),
  on(
    StoreItemActions.validateQueuedTasks.success,
    (state: ModeState, { compatibleTable }): ModeState =>
      modeAdapter.updateOne(
        {
          id: state.currentMode,
          changes: {
            items: applyFunctionOnStoreItemsWhereRecursive(
              (item) => item.status === TaskStatus.QUEUED,
              state.entities![state.currentMode]!.items,
              taskAdapter,
              (item: StoreItem, itemState: StoreItemsState) => {
                if (item.type === 'task') {
                  const checks = compatibleTable.find((a) => a.id === item.id)?.checks;
                  return taskAdapter.updateOne(
                    {
                      id: item.id,
                      changes: {
                        invalid: (checks?.map((a) => a.isValid) ?? []).includes(false),
                        checks,
                      },
                    },
                    itemState,
                  );
                }
                return itemState;
              },
            ),
          },
        },
        state,
      ),
  ),
  on(StoreItemActions.toggleAllSelected.do, (state: ModeState): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: selectAllRows(state, taskAdapter, !state.entities[state.currentMode]!.allSelected),
          allSelected: !state.entities[state.currentMode]!.allSelected,
        },
      },
      state,
    );
  }),
  on(StoreItemActions.selectAllItems.do, (state: ModeState): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: selectAllRows(state, taskAdapter, true),
          allSelected: true,
        },
      },
      state,
    );
  }),
  on(StoreItemActions.deselectAllItems.do, (state: ModeState): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: selectAllRows(state, taskAdapter, false),
          allSelected: false,
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
    state = modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: removeStoreItemsWithIDs(ids, state.entities[state.currentMode]!.items, taskAdapter),
        },
      },
      state,
    );
    state = updateStatistics(state, state.currentMode);
    return state;
  }),
  on(StoreItemActions.importItemsFromProcessingQueue.success, (state: ModeState, { mode, items, counters }) => {
    return modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items,
        },
      },
      {
        ...state,
        counters,
      },
    );
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
  on(ModeActions.closeToolLoader.do, (state: ModeState): ModeState => {
    const currentMode = state.entities[state.currentMode]!;
    const openedTool = currentMode.openedTool!;

    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([openedTool.taskID], currentMode.items, taskAdapter, (item, itemsState) => {
            return changeTaskOperation(
              item.id,
              openedTool.operationID,
              (operation, itemsState) => {
                return {
                  ...operation,
                  rounds: [
                    ...operation.rounds.slice(0, operation.rounds.length - 1),
                    ...(operation.rounds.length > 1
                      ? []
                      : [
                          {
                            status: TaskStatus.READY,
                            results: [],
                          } as StoreTaskOperationProcessingRound,
                        ]), // if rounds > 1 remove current round because not needed
                  ],
                };
              },
              taskAdapter,
              currentMode.items,
            );
          }),
          openedTool: undefined,
        },
      },
      state,
    );
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
  on(StoreItemActions.processStoreItem.success, (state, { id, mode }) => {
    state = modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([id], state.entities[mode]!.items, taskAdapter, (item, itemsState) => {
            return taskAdapter.updateOne(
              {
                id: item.id,
                changes: {
                  status: TaskStatus.FINISHED,
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
  on(StoreItemActions.processNextOperation.do, (state: ModeState, { taskID, mode }) =>
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([taskID], state.entities![state.currentMode]!.items, taskAdapter, (item, itemsState) => {
            if (item.type === 'task') {
              itemsState = taskAdapter.updateOne(
                {
                  id: item.id,
                  changes: {
                    status: TaskStatus.PROCESSING,
                  },
                },
                itemsState,
              );
            }
            return itemsState;
          }),
        },
      },
      state,
    ),
  ),
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
        const allOperationsFinished = !taskItem
          .operations!.filter((op) => op.enabled)
          .map((op) => getLastOperationRound(op)?.status === TaskStatus.FINISHED)
          .includes(false);
        if (allOperationsFinished) {
          taskStatus = TaskStatus.FINISHED;
        }
      }
    }

    console.log(`Change task ${taskItem!.id} from ${taskItem!.status} to ${taskStatus}`);
    state = modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([taskID], state.entities[mode]!.items, taskAdapter, (item, itemsState) => {
            const operations = state.entities![mode]!.items.entities![taskID]!.operations!.map((op) => {
              if (op.id === operation.id) {
                return {
                  ...operation,
                  parseProtocol: parseProtocol(operation.protocol),
                };
              }
              return op;
            });
            let files = item.files;

            if (operation.name === 'Upload') {
              // replace URL after (re)upload in task files
              // and remove blob file
              files = files?.map((a) => {
                const found = getLastOperationRound(operation)?.results?.find((b) => a.name === b.name);
                if (found) {
                  return {
                    ...a,
                    url: found.url,
                    online: true,
                    blob: undefined,
                    content: found?.content ?? a.content,
                  };
                }
                return a;
              });
            }

            return taskAdapter.updateOne(
              {
                id: item.id,
                changes: {
                  status: taskStatus,
                  operations,
                  files,
                },
              },
              itemsState,
            );
          }),
          openedTool: undefined,
        },
      },
      state,
    );

    state = updateStatistics(state, mode);
    return state;
  }),
  on(StoreItemActions.processNextOperation.fail, (state: ModeState, { taskID, mode, error, operation }) => {
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
                    if (op.id === operation.id) {
                      return {
                        ...op,
                        rounds: [
                          ...op.rounds.slice(0, op.rounds.length - 1),
                          {
                            ...op.rounds[op.rounds.length - 1],
                            status: TaskStatus.ERROR,
                            protocol: (op.protocol ?? '') + "ERROR: " + error + '<br/>',
                            parsedProtocol: parseProtocol((op.protocol ?? '') + "ERROR: " + error + '<br/>'),
                          },
                        ],
                      };
                    }
                    return op;
                  }),
                  status: TaskStatus.ERROR,
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
  on(StoreItemActions.reuploadFilesForOperations.success, (state: ModeState, { mode, list }) => {
    for (const listItem of list) {
      const taskID = listItem.taskID;
      const operationID = listItem.operationID;
      const roundIndex = listItem.roundIndex;

      for (const file of listItem.files) {
        // replace old file with new one
        state = modeAdapter.updateOne(
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
                              ...op.rounds.slice(0, roundIndex),
                              {
                                ...op.rounds[roundIndex],
                                results: op.rounds[roundIndex].results.map((result) => {
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
                              ...op.rounds.slice(roundIndex + 1),
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
    }

    return state;
  }),
  on(StoreItemActions.runOperationWithTool.success, (state: ModeState, { mode, taskID, operationID, url, audioFile, language, operationName }) => {
    const task = getStoreItemsWhereRecursive((item) => item.id === taskID, state.entities[mode]!.items)[0];
    const operationIndex = task.operations!.findIndex((a) => a.id === operationID);
    let operation = task.operations![operationIndex];

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
              operationName,
              audioFile,
              language,
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
  on(StoreItemActions.updateTaskFiles.do, (state: ModeState, { taskID, mode, files }) =>
    modeAdapter.updateOne(
      {
        id: mode,
        changes: {
          items: applyFunctionOnStoreItemsWithIDsRecursive([taskID], state.entities[mode]!.items, taskAdapter, (item, itemsState) => {
            return taskAdapter.updateOne(
              {
                id: item.id,
                changes: {
                  files: item.files?.map((a) => {
                    const found = files.find((b) => b.name === a.name);
                    return {
                      ...a,
                      url: found?.url ?? a.url,
                      online: found?.url ? true : a.online,
                      blob: found ? undefined : a.blob,
                    } as StoreFile;
                  }),
                },
              },
              itemsState,
            );
          }),
        },
      },
      state,
    ),
  ),
  on(StoreItemActions.receiveToolData.success, (state: ModeState, { file }) => {
    const currentMode = state.entities[state.currentMode]!;
    const openedTool = currentMode.openedTool!;
    const task = getOneTaskItemWhereRecursive((item) => item.id === openedTool.taskID, currentMode.items)!;
    const operationIndex = task.operations.findIndex((a) => a.id === openedTool.operationID);

    // reset next operations
    for (let i = operationIndex + 1; i < task.operations.length; i++) {
      const operation = task.operations[i];
      if (
        operation.enabled &&
        [TaskStatus.ERROR, TaskStatus.FINISHED, TaskStatus.PROCESSING].includes(getLastOperationRound(operation)?.status as TaskStatus)
      ) {
        state = modeAdapter.updateOne(
          {
            id: state.currentMode,
            changes: {
              items: changeTaskOperation(
                task.id,
                operation.id,
                (op, itemsState) => addProcessingRound(op),
                taskAdapter,
                state.entities![state.currentMode]!.items,
              ),
            },
          },
          state,
        );
      }
    }

    /*
    TODO where to add?


    if (
      this.toolSelectedOperation &&
      this.toolSelectedOperation.task &&
      this.toolSelectedOperation.task.status === 'FINISHED' &&
      this.toolSelectedOperation.task.asrOperation &&
      this.toolSelectedOperation.task.asrOperation.serviceProvider &&
      this.toolSelectedOperation.task.asrOperation.language
    ) {
      this.toolSelectedOperation.task.restart(this.httpClient, [
        {
          name: 'GoogleASR',
          value: this.taskService.accessCode,
        },
      ]);
    }
    this.onBackButtonClicked();
     */

    return state;
  }),
  on(StoreItemActions.setSelectedItemsByIndex.do, (state: ModeState, { indices }) => {
    return setSelectionByIndex(indices, true, state, modeAdapter, taskAdapter, true);
  }),
  on(StoreItemActions.removeAppendingForSelectedItems.do, (state: ModeState) =>
    modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          items: applyFunctionOnStoreItemsWhereRecursive(
            (item) => item.selected === true,
            state.entities[state.currentMode]!.items,
            taskAdapter,
            (item, itemsState) => {
              if (item.type === 'task' && item.files?.find((a) => a.type.includes('audio'))) {
                const lastRound = last(item.operations![1].rounds)!;
                return taskAdapter.updateOne(
                  {
                    id: item.id,
                    changes: {
                      files: item.files?.filter((a) => a.type.includes('audio')),
                      operations: [
                        item.operations![0],
                        {
                          ...item.operations![1],
                          enabled: true,
                          rounds: [
                            ...item.operations![1].rounds.slice(0, item.operations![1].rounds.length - 1),
                            {
                              ...lastRound,
                              status: lastRound.status === TaskStatus.SKIPPED ? TaskStatus.PENDING : lastRound.status,
                            },
                          ],
                        },
                        ...item.operations!.slice(2),
                      ],
                    },
                  },
                  itemsState,
                );
              }

              return itemsState;
            },
          ),
        },
      },
      state,
    ),
  ),
];

function selectAllRows(state: ModeState, taskAdapter: EntityAdapter<StoreItem>, selected: boolean) {
  return applyFunctionOnStoreItemsWhereRecursive(
    () => true,
    state.entities[state.currentMode]!.items,
    taskAdapter,
    (item, itemsState) => {
      return taskAdapter.updateOne(
        {
          id: item.id,
          changes: {
            selected,
          },
        },
        itemsState,
      );
    },
  );
}

function setSelection(
  ids: number[],
  selected: boolean,
  state: ModeState,
  modeAdapter: EntityAdapter<Mode<any>>,
  taskAdapter: EntityAdapter<StoreItem>,
  deselectOthers?: boolean,
) {
  const itemsState = !deselectOthers ? state.entities[state.currentMode]!.items : selectAllRows(state, taskAdapter, false);

  return modeAdapter.updateOne(
    {
      id: state.currentMode,
      changes: {
        items: applyFunctionOnStoreItemsWithIDsRecursive(ids, itemsState, taskAdapter, (item, itemsState) => {
          return taskAdapter.updateOne(
            {
              id: item.id,
              changes: {
                selected,
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

function setSelectionByIndex(
  indices: number[],
  selected: boolean,
  state: ModeState,
  modeAdapter: EntityAdapter<Mode<any>>,
  taskAdapter: EntityAdapter<StoreItem>,
  deselectOthers?: boolean,
) {
  return modeAdapter.updateOne(
    {
      id: state.currentMode,
      changes: {
        items: applyFunctionOnStoreItemsWhereRecursive(
          () => true,
          state.entities[state.currentMode]!.items,
          taskAdapter,
          (item, itemsState, i) => {
            return taskAdapter.updateOne(
              {
                id: item.id,
                changes: {
                  selected: indices.includes(i),
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

function isSomethingInvalid(
  task: StoreItemTask,
  defaultOperations: {
    enabled: boolean;
    factory: OperationFactory;
  }[],
) {
  if (defaultOperations[1].enabled && task.checks) {
    return task.checks.findIndex((a) => !a.isValid) > -1;
  }

  return false;
}
