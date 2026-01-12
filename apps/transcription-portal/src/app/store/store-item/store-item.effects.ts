import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Action, Store } from '@ngrx/store';
import { AnnotJSONConverter, IFile, OAnnotJSON, PartiturConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { SubscriptionManager } from '@octra/utilities';
import { catchError, exhaustMap, filter, forkJoin, from, map, of, Subscription, tap, timer, withLatestFrom } from 'rxjs';
import { existsFile } from '../../obj/functions';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { AlertService } from '../../shared/alert.service';
import { RootState } from '../app';
import { IDBActions, IDBLoadedResults } from '../idb/idb.actions';
import { TPortalModes } from '../mode';
import { modeAdapter, taskAdapter } from '../mode/mode.adapters';
import { getAllTasks } from '../mode/mode.functions';
import { OctraOperationFactory, StoreTaskOperation, UploadOperationFactory } from '../operation';
import { getLastOperationResultFromLatestRound, getLastOperationRound } from '../operation/operation.functions';
import { PreprocessingActions } from '../preprocessing/preprocessing.actions';
import { CompatibleResult, StoreAudioFile, StoreFile, StoreFileDirectory, StoreItemTask, TaskStatus } from './store-item';
import { StoreItemActions } from './store-item.actions';
import {
  applyFunctionOnStoreItemsWhereRecursive,
  convertFileInfoToStoreFile,
  getLatestResultFromPreviousEnabledOperation,
  getOneTaskItemWhereRecursive,
  getStoreItemsWhereRecursive,
  isStoreFileAvailable,
  updateTaskFilesWithSameFile,
} from './store-item.functions';
import { OctraWindowMessageEventData } from './store-items-state';

@Injectable()
export class StoreItemEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  protected ngbModalService = inject(NgbModal);
  protected httpClient = inject(HttpClient);
  protected alertService = inject(AlertService);

  private subscrManager!: SubscriptionManager<Subscription>;

  constructor() {
    this.subscrManager = new SubscriptionManager();
    console.log('init subscr manager');
  }

  initTasks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.initIDB.loaded),
      withLatestFrom(this.store),
      exhaustMap(([{ intern, annotationTasks, summarizationTasks, userSettings }, state]: [IDBLoadedResults, RootState]) => {
        // this.taskService.init();
        return of(
          StoreItemActions.prepareTasks.do({
            annotationTasks,
            summarizationTasks,
          }),
        );
      }),
    ),
  );

  prepareTasks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.prepareTasks.do),
      exhaustMap(() => {
        return of(StoreItemActions.prepareTasks.success());
      }),
    ),
  );

  prepareTasksSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.prepareTasks.success),
      exhaustMap(() => {
        return of(StoreItemActions.importTasks.success());
      }),
    ),
  );

  importQueueItems$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreprocessingActions.processQueueItem.success),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) =>
        state.modes.entities[state.modes.currentMode]!.preprocessor.entities[action.id]!.status === 'FINISHED'
          ? of(
              StoreItemActions.importItemsFromProcessingQueue.do({
                id: action.id,
                mode: action.mode,
                results: action.results,
              }),
            )
          : of(),
      ),
    ),
  );

  processingQueueImported$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.importItemsFromProcessingQueue.do),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ mode, id, results }, state]: [
          {
            id: number;
            mode: TPortalModes;
            results: (StoreFile | StoreAudioFile | StoreFileDirectory)[];
          },
          RootState,
        ]) => {
          let modesState = state.modes;
          const addedItemIDs: number[] = [];

          for (const result of results) {
            const itemChange = updateTaskFilesWithSameFile(
              result,
              modesState.entities[mode]!.items,
              taskAdapter,
              modesState.counters,
              modesState.entities[mode]!.defaultOperations,
              modesState.entities[mode]!.options,
            );
            modesState = modeAdapter.updateOne(
              {
                id: mode,
                changes: {
                  items: itemChange.state,
                },
              },
              {
                ...modesState,
                counters: itemChange.counters,
              },
            );
            addedItemIDs.push(...itemChange.addedIDs);
          }

          return of(
            StoreItemActions.importItemsFromProcessingQueue.success({
              id: id,
              mode: mode,
              counters: modesState.counters,
              items: modesState.entities[mode]!.items,
              addedItemIDs,
            }),
          );
        },
      ),
    ),
  );

  validateQueuedTasksAfterOptionsChanged$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.changeProcessingOptionsForEachQueuedTask.do),
      exhaustMap(() => of(StoreItemActions.validateQueuedTasks.do())),
    ),
  );

  requestSavingTaskAfterMarkedAsPending$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.markValidQueuedTasksAsPending.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) => {
        const itemIDs = getAllTasks(state.modes.entities![state.modes.currentMode]!.items)
          .filter((a) => a.status === TaskStatus.QUEUED && !a.invalid)
          .map((a) => a.id);
        return of(
          StoreItemActions.markValidQueuedTasksAsPending.success({
            itemIDs,
          }),
        );
      }),
    ),
  );

  validateQueuedTasks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.validateQueuedTasks.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]) => {
        const currentMode = state.modes.entities![state.modes.currentMode]!;
        const compatibleTable: {
          id: number;
          fileName: string;
          checks: CompatibleResult[];
        }[] = [];
        const queuedTasks: StoreItemTask[] = getAllTasks(currentMode.items).filter((a) => a.status === TaskStatus.QUEUED);

        for (const task of queuedTasks) {
          if (task.status === TaskStatus.QUEUED) {
            compatibleTable.push({
              id: task.id,
              fileName: task.files[0].name,
              checks: this.checkAudioFileCompatibility(
                task.files[0] as StoreAudioFile,
                task.operations[1].serviceProviderName,
                state.app.settings?.api.services,
              ),
            });
          }
        }

        return of(StoreItemActions.validateQueuedTasks.success({ compatibleTable }));
      }),
    ),
  );

  startProcessing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StoreItemActions.startProcessing.do,
        StoreItemActions.processStoreItem.success,
        StoreItemActions.processStoreItem.fail,
        StoreItemActions.reuploadFilesForOperations.success,
        StoreItemActions.reuploadFilesForOperations.fail,
        StoreItemActions.processNextOperation.do,
        StoreItemActions.processNextOperation.fail,
        StoreItemActions.markValidQueuedTasksAsPending.success, // add from queue
      ),
      withLatestFrom(this.store),
      filter(([action, state]: [any, RootState]) => {
        const currentMode = state.modes.entities![state.modes.currentMode]!;
        return currentMode.overallState === 'processing';
      }),
      exhaustMap(([action, state]: [any, RootState]) =>
        of(
          StoreItemActions.processNextStoreItem.do({
            mode: state.modes.currentMode,
          }),
        ),
      ),
    ),
  );

  processNextItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.processNextStoreItem.do),
      withLatestFrom(this.store),
      exhaustMap(([{ mode }, state]: [{ mode: TPortalModes }, RootState]) => {
        if (state.modes.entities[mode]!.statistics.running < 3) {
          const nextTask = getOneTaskItemWhereRecursive(
            (item) =>
              item.status === TaskStatus.PENDING ||
              (item.status !== TaskStatus.UPLOADING &&
                item.status !== TaskStatus.PROCESSING &&
                item.files?.find((a) => a.blob !== undefined) !== undefined),
            state.modes.entities[mode]!.items,
          );
          if (!nextTask) {
            return of(
              StoreItemActions.processNextStoreItem.nothingToDo({
                mode,
              }),
            );
          }
          console.log(`Next task is ${nextTask.id} with status ${nextTask.status}`);
          return of(StoreItemActions.processStoreItem.do({ id: nextTask.id, mode }));
        } else {
          console.warn('More than 3 processes running');
        }

        return of(
          StoreItemActions.processNextStoreItem.nothingToDo({
            mode,
          }),
        );
      }),
    ),
  );

  processStoreItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.processStoreItem.do),
      withLatestFrom(this.store),
      exhaustMap(([{ id, mode }, state]: [{ id: number; mode: TPortalModes }, RootState]) => {
        const currentMode = state.modes.entities[mode]!;
        const item = getOneTaskItemWhereRecursive((item) => item.id === id, currentMode.items);

        if (!item) {
          return of(
            StoreItemActions.processStoreItem.fail({
              error: `Can't start task ${id}: Not found.`,
            }),
          );
        }

        // add if audio blob exists, do upload
        return of(StoreItemActions.processNextOperation.do({ mode, taskID: item.id }));
      }),
    ),
  );

  /**
   * This event iterates through the next operations and checks an operation for reuploading its results before running. If an ready operation was found, it's going to run.
   */
  processNextOperation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StoreItemActions.processNextOperation.check),
        withLatestFrom(this.store),
        tap(([{ mode, taskID }, state]: [{ mode: TPortalModes; taskID: number }, RootState]) => {
          const currentMode = state.modes.entities[mode]!;
          const defaultOperations = currentMode.defaultOperations;
          let item = getOneTaskItemWhereRecursive((item) => item.id === taskID, state.modes.entities[mode]!.items);

          if (!item) {
            this.store.dispatch(
              StoreItemActions.processStoreItem.fail({
                error: `Can't check next operation. task ${taskID}: Not found.`,
              }),
            );
            return;
          }

          let lastNonSkippableOperation: StoreTaskOperation | undefined;
          let foundOperation: StoreTaskOperation | undefined = undefined;

          for (let i = 0; i < defaultOperations.length; i++) {
            const operation: StoreTaskOperation = item!.operations[i];
            const lastRound = getLastOperationRound(operation);

            if (operation.enabled) {
              if (
                lastRound?.status === 'PENDING' &&
                (!lastNonSkippableOperation || getLastOperationRound(lastNonSkippableOperation)?.status === TaskStatus.FINISHED)
              ) {
                foundOperation = operation;
                break;
              }
              lastNonSkippableOperation = operation;
            } else {
              // operation is disabled, skip
            }
          }

          if (foundOperation) {
            // there is an operation to run
            // check if audio blob in task.files is available
            if (foundOperation.name === 'Upload' && item!.files.find((a) => a.blob !== undefined) !== undefined) {
              // (re)upload blob if needed
              // set upload operation to pending and remove results
              foundOperation = {
                ...foundOperation,
                rounds: [
                  {
                    status: TaskStatus.PENDING,
                    results: [],
                  },
                ],
              };
              item = {
                ...item,
                status: TaskStatus.UPLOADING,
                operations: [
                  {
                    ...foundOperation,
                  },
                  ...item!.operations!.slice(1),
                ],
              };
              this.store.dispatch(
                StoreItemActions.processNextOperation.run({
                  taskID,
                  operationID: foundOperation.id,
                  mode,
                  item,
                }),
              );
            } else if (lastNonSkippableOperation && lastNonSkippableOperation.name !== 'Upload') {
              // check if files of previous operation need to be reuploaded.
              const lastRoundOfPreviousOperation = getLastOperationRound(lastNonSkippableOperation);
              if (
                lastRoundOfPreviousOperation &&
                lastRoundOfPreviousOperation.status === TaskStatus.FINISHED &&
                lastRoundOfPreviousOperation.results.length > 0
              ) {
                const promises = lastRoundOfPreviousOperation.results.map((a) => existsFile(a.url, this.httpClient));
                Promise.all(promises)
                  .then((onlineChecks) => {
                    const offlineIndices = onlineChecks.map((online, index) => ({ index, online })).filter((a) => !a.online);
                    if (offlineIndices.length > 0) {
                      this.store.dispatch(
                        StoreItemActions.reuploadFilesForOperations.do({
                          mode,
                          list: [
                            {
                              taskID,
                              operationID: lastNonSkippableOperation.id,
                              roundIndex: lastNonSkippableOperation.rounds.length - 1,
                              files: lastRoundOfPreviousOperation.results,
                            },
                          ],
                          actionAfterSuccess: StoreItemActions.processNextOperation.run({
                            taskID,
                            operationID: foundOperation!.id,
                            mode,
                          }),
                        }),
                      );
                    } else {
                      this.store.dispatch(
                        StoreItemActions.processNextOperation.run({
                          taskID,
                          operationID: foundOperation!.id,
                          mode,
                        }),
                      );
                    }
                  })
                  .catch(() => {
                    this.store.dispatch(
                      StoreItemActions.processNextOperation.run({
                        taskID,
                        operationID: foundOperation!.id,
                        mode,
                      }),
                    );
                  });
              } else {
                this.store.dispatch(
                  StoreItemActions.processNextOperation.run({
                    taskID,
                    operationID: foundOperation.id,
                    mode,
                  }),
                );
              }
            } else {
              this.store.dispatch(
                StoreItemActions.processNextOperation.run({
                  taskID,
                  operationID: foundOperation.id,
                  mode,
                }),
              );
            }
          } else {
            if (lastNonSkippableOperation && getLastOperationRound(lastNonSkippableOperation)?.status === 'FINISHED') {
              // end of the chain reached => task finished
              this.store.dispatch(
                StoreItemActions.processStoreItem.success({
                  mode,
                  id: taskID,
                }),
              );
            } else {
              // beginning of the chain, set status to ready.
              this.store.dispatch(
                StoreItemActions.changeTaskStatus.do({
                  mode,
                  taskID,
                  status: TaskStatus.READY,
                }),
              );
            }
          }
        }),
      ),
    { dispatch: false },
  );

  /**
   * this event is triggered after an operation was checked successfully.
   */
  runNextOperation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StoreItemActions.processNextOperation.run),
        withLatestFrom(this.store),
        tap(([{ mode, taskID, operationID }, state]: [{ mode: TPortalModes; taskID: number; operationID: number }, RootState]) => {
          const currentMode = state.modes.entities[mode]!;
          const defaultOperations = currentMode.defaultOperations;
          const item = getOneTaskItemWhereRecursive((item) => item.id === taskID, state.modes.entities[mode]!.items);
          const operationIndex = item?.operations?.findIndex((a) => a.id === operationID);
          const operation = operationIndex !== undefined && operationIndex > -1 ? item?.operations[operationIndex] : undefined;

          if (!item) {
            this.store.dispatch(
              StoreItemActions.processStoreItem.fail({
                error: `Can't process next operation. task ${taskID}: Not found.`,
              }),
            );
            return;
          }

          if (operationIndex === undefined || !operation) {
            this.store.dispatch(
              StoreItemActions.processStoreItem.fail({
                error: `Can't process next operation. Operation with id ${operationID} in task ${taskID}: Not found.`,
              }),
            );
            return;
          }

          const defaultOperation = defaultOperations[operationIndex];
          const lastRound = getLastOperationRound(operation);
          const runOperation = lastRound?.status === 'PENDING';

          if (runOperation) {
            if (!['OCTRA', 'Emu WebApp'].includes(defaultOperation.factory.name)) {
              // operation is not of type OCTRA or EMU webApp
              const opTicket = `task[${taskID}];op[${operation.id}];date[${Date.now()}]`;
              const opSubscrManager = new SubscriptionManager();
              this.subscrManager.add(
                defaultOperation.factory.run(item, operation, this.httpClient, opSubscrManager).subscribe({
                  next: (event) => {
                    if (getLastOperationRound(event.operation)?.status === 'FINISHED') {
                      this.subscrManager.add(
                        timer(1000).subscribe({
                          next: () => {
                            this.store.dispatch(
                              StoreItemActions.processNextOperation.success({
                                mode,
                                taskID,
                                operation: event.operation,
                              }),
                            );
                          },
                        }),
                      );
                    } else {
                      this.store.dispatch(
                        StoreItemActions.changeOperation.do({
                          mode,
                          taskID,
                          operation: event.operation,
                        }),
                      );
                    }
                    opSubscrManager.destroy();
                  },
                  error: (err) => {
                    console.error(err);
                    this.store.dispatch(
                      StoreItemActions.processNextOperation.fail({
                        mode,
                        taskID,
                        operation: operation,
                        error: typeof err === 'string' ? err : err.message,
                      }),
                    );
                    opSubscrManager.destroy();
                  },
                }),
                opTicket,
              );
            } else if (lastRound) {
              // is tool
              if (lastRound.status === TaskStatus.PENDING) {
                this.store.dispatch(
                  StoreItemActions.changeOperation.do({
                    mode,
                    operation: {
                      ...operation,
                      rounds: [
                        ...operation.rounds.slice(0, operation.rounds.length - 1),
                        {
                          ...lastRound,
                          status: TaskStatus.READY,
                        },
                      ],
                    },
                    taskID,
                  }),
                );
              }
            }
          }
        }),
      ),
    { dispatch: false },
  );

  operationProcessingSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.processNextOperation.success),
      withLatestFrom(this.store),
      exhaustMap(([{ mode, taskID }, state]: [{ mode: TPortalModes; taskID: number }, RootState]) => {
        return of(
          StoreItemActions.processNextOperation.do({
            mode,
            taskID,
          }),
        );
      }),
    ),
  );

  updateFileURLsAfterUploadSuccess = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.processNextOperation.success),
      withLatestFrom(this.store),
      exhaustMap(([{ mode, taskID, operation }, state]: [{ mode: TPortalModes; taskID: number; operation: StoreTaskOperation }, RootState]) => {
        if (operation.name === 'Upload') {
          return of(
            StoreItemActions.updateURLsForFilesAfterUpload.do({
              mode,
              taskID,
              operation,
            }),
          );
        }
        return of();
      }),
    ),
  );

  updateFileURLs$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.updateURLsForFilesAfterUpload.do),
      withLatestFrom(this.store),
      exhaustMap(([{ mode, taskID, operation }, state]: [{ mode: TPortalModes; taskID: number; operation: StoreTaskOperation }, RootState]) => {
        if (operation.name === 'Upload') {
          // something uploaded, check if their other tasks with the same file
          const currentMode = state.modes.entities[mode]!;
          const lastOperationRound = getLastOperationRound(operation)!;
          const itemIDs: number[] = [];
          const iState = applyFunctionOnStoreItemsWhereRecursive(
            () => true,
            currentMode.items,
            taskAdapter,
            (item, itemsState, i) => {
              if (item.type === 'task') {
                let task = item as StoreItemTask;
                const files = [...task.files];
                let somethingFound = false;
                for (let i = 0; i < files.length; i++) {
                  const file = files[i];
                  let foundIndex: number | undefined = lastOperationRound.results.findIndex((a) => a.hash === file.hash);
                  let foundFile: (StoreFile | StoreAudioFile) | undefined;

                  if (foundIndex !== undefined && foundIndex > -1) {
                    files[i] = {
                      ...files[i],
                      url: lastOperationRound.results[foundIndex].url,
                      online: true,
                    };
                    foundFile = files[i];
                    somethingFound = true;
                    itemIDs.push(task.id);
                  }

                  const otherItemUploadOperationRound = getLastOperationRound(task.operations[0]);
                  foundIndex = otherItemUploadOperationRound?.results.findIndex((a) => {
                    if (a.hash === file.hash) {
                      return true;
                    } else {
                      // fallback to name
                      return a.attributes.originalFileName === file.attributes.originalFileName;
                    }
                  });

                  if (foundIndex !== undefined && foundIndex > -1 && foundFile) {
                    // replace URL in Upload result
                    task = {
                      ...task,
                      operations: [
                        {
                          ...task.operations[0],
                          rounds: [
                            {
                              status: TaskStatus.FINISHED,
                              results: [
                                ...otherItemUploadOperationRound!.results!.slice(0, foundIndex),
                                foundFile,
                                ...otherItemUploadOperationRound!.results!.slice(foundIndex + 1),
                              ],
                            },
                          ],
                        },
                        ...task.operations.slice(1),
                      ],
                    };
                  }
                }

                if (somethingFound) {
                  return taskAdapter.updateOne(
                    {
                      id: item.id,
                      changes: {
                        ...task,
                        files,
                      },
                    },
                    itemsState,
                  );
                }
              }
              return itemsState;
            },
          );

          return of(
            StoreItemActions.updateURLsForFilesAfterUpload.success({
              mode,
              itemsState: iState,
              itemIDs,
            }),
          );
        }
        return of();
      }),
    ),
  );

  doNextOperation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.processNextOperation.do),
      withLatestFrom(this.store),
      exhaustMap(([{ mode, taskID }, state]: [{ mode: TPortalModes; taskID: number }, RootState]) => {
        return of(
          StoreItemActions.processNextOperation.check({
            mode,
            taskID,
          }),
        );
      }),
    ),
  );

  toggleProcessing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.toggleProcessing.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) => {
        const currentMode = state.modes.entities[state.modes.currentMode]!;
        if (currentMode.overallState !== 'processing') {
          return of(StoreItemActions.startProcessing.do());
        }
        return of(StoreItemActions.stopProcessing.do());
      }),
    ),
  );

  openTool$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StoreItemActions.runOperationWithTool.do),
        withLatestFrom(this.store),
        tap(
          ([{ taskID, operationID, audioFile, operationName, language }, state]: [
            { operationID: number; taskID: number; operationName: string; language: string; audioFile: StoreAudioFile },
            RootState,
          ]) => {
            // operation is of type tool and ready
            const currentState = state.modes.entities[state.modes.currentMode]!;
            const task = getOneTaskItemWhereRecursive((item) => item.id === taskID, currentState.items)!;
            const taskOperations = task.operations!;
            const opIndex = taskOperations.findIndex((a) => a.id === operationID)!;
            const { factory } = currentState.defaultOperations[opIndex]!;
            let operation = taskOperations[opIndex];
            const uploadOperation = taskOperations[0];
            const previousOperation = opIndex > 0 ? taskOperations[opIndex - 1] : undefined;
            const availableUploadedAudioFile = getLastOperationRound(uploadOperation)?.results.find((a) => a.type.includes('audio'));
            const droppedAudioFile = task.files!.find((a) => a.type.includes('audio'))?.blob;
            const isPreviousTaskDefinedAndLastResultNotAvailable = previousOperation
              ? !isStoreFileAvailable(getLastOperationResultFromLatestRound(previousOperation))
              : false;

            if (!availableUploadedAudioFile?.online && !droppedAudioFile) {
              // audio file is not available
              this.alertService.showAlert(
                'warning',
                `Please add the audio file "${task.files![0].attributes.originalFileName}" and run "${factory.title}" again.`,
                10,
              );
              this.store.dispatch(
                StoreItemActions.changeOperation.do({
                  mode: state.modes.currentMode,
                  taskID,
                  operation: {
                    ...uploadOperation,
                    rounds: [
                      {
                        status: TaskStatus.PENDING,
                        results: [],
                      },
                    ],
                  },
                }),
              );
            } else if (!availableUploadedAudioFile?.online && droppedAudioFile) {
              // start upload process
              this.alertService.showAlert(
                'info',
                `Please wait until file ${task.files![0].attributes.originalFileName}` + ` being uploaded and do '${factory.title}' again.`,
              );
              this.store.dispatch(StoreItemActions.startProcessing.do());
            } else if (previousOperation?.enabled && getLastOperationRound(previousOperation)?.status !== 'FINISHED') {
              // audio file available but no result of previous operation
              this.alertService.showAlert('info', `Please run ${previousOperation?.name} for this task again.`, 12);
            } else {
              // audio file exists and last result of previous operation exists
              let file: StoreFile | undefined = undefined;
              if (getLastOperationRound(operation)?.status === 'FINISHED') {
                if (!(getLastOperationResultFromLatestRound(operation)?.online || !getLastOperationResultFromLatestRound(operation)?.url)) {
                  // file for last result of current tool exists, but isn't available via URL
                  // reupload result from tool operation
                  file = getLastOperationResultFromLatestRound(operation);
                }
              } else if (
                previousOperation &&
                getLastOperationRound(previousOperation) &&
                !(getLastOperationResultFromLatestRound(previousOperation)?.online || !getLastOperationResultFromLatestRound(previousOperation)?.url)
              ) {
                // reupload result from previous operation
                // local available, reupload
                file = getLastOperationResultFromLatestRound(previousOperation);
                operation = previousOperation;
              }

              if (file && operation) {
                this.store.dispatch(
                  StoreItemActions.reuploadFilesForOperations.do({
                    mode: state.modes.currentMode,
                    list: [
                      {
                        taskID,
                        operationID: operation.id,
                        roundIndex: operation.rounds.length - 1,
                        files: [file],
                      },
                    ],
                    actionAfterSuccess: StoreItemActions.runOperationWithTool.prepare({
                      mode: state.modes.currentMode,
                      taskID,
                      operationID,
                      operationName,
                      roundIndex: operation.rounds.length - 1,
                      language,
                    }),
                  }),
                );
              } else {
                this.store.dispatch(
                  StoreItemActions.runOperationWithTool.prepare({
                    taskID,
                    operationID,
                    operationName,
                    roundIndex: operation.rounds.length - 1,
                    mode: state.modes.currentMode,
                    language,
                  }),
                );
              }
            }
          },
        ),
      ),
    { dispatch: false },
  );

  reuploadFile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.reuploadFilesForOperations.do),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ mode, list, actionAfterSuccess }, state]: [
          {
            mode: TPortalModes;
            list: {
              taskID: number;
              operationID: number;
              roundIndex: number;
              files: StoreFile[];
            }[];
            actionAfterSuccess: Action;
          },
          RootState,
        ]) =>
          forkJoin(list.map((listItem) => UploadOperationFactory.upload(listItem.files, this.httpClient))).pipe(
            map((httpEvents) =>
              StoreItemActions.reuploadFilesForOperations.success({
                mode,
                list: httpEvents.map((httpEvent, i) => ({
                  taskID: list[i].taskID,
                  operationID: list[i].operationID,
                  roundIndex: list[i].roundIndex,
                  files: httpEvent.urls!.map((url, j) => ({
                    ...list[i].files[j],
                    online: true,
                    url: httpEvent.urls![j],
                    blob: undefined,
                  })),
                })),
                actionAfterSuccess,
              }),
            ),
            catchError((err) =>
              of(
                StoreItemActions.reuploadFilesForOperations.fail({
                  error: typeof err === 'string' ? err : err?.message,
                }),
              ),
            ),
          ),
      ),
    ),
  );

  reuploadFileSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.reuploadFilesForOperations.success),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ actionAfterSuccess }]: [
          {
            actionAfterSuccess: Action;
          },
          RootState,
        ]) => of(actionAfterSuccess),
      ),
    ),
  );

  openToolPrepare$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.runOperationWithTool.prepare),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ taskID, operationID, operationName, language, mode, roundIndex: number }, state]: [
          { operationID: number; taskID: number; operationName: string; language: string; mode: TPortalModes; roundIndex: number },
          RootState,
        ]) => {
          const task = getStoreItemsWhereRecursive((item) => item.id === taskID, state.modes.entities[mode]!.items)[0] as StoreItemTask;
          const operationIndex = task.operations!.findIndex((a) => a.id === operationID);
          const operation = task.operations![operationIndex];
          const { factory } = state.modes.entities[mode]!.defaultOperations[operationIndex];
          const audioFile = task.files.find((a) => a.type.includes('audio')) as StoreAudioFile | undefined;
          let transcriptFile: StoreFile | undefined = getLastOperationResultFromLatestRound(operation);

          if (audioFile) {
            if (!transcriptFile) {
              // get from previous enabled operation
              transcriptFile = getLatestResultFromPreviousEnabledOperation(task, operation);
            }
            if (!transcriptFile) {
              // get task files
              transcriptFile = task.files.find((a) => !a.type.includes('audio'));
            }

            return from((factory as OctraOperationFactory).getToolURL(audioFile, transcriptFile, this.httpClient)).pipe(
              exhaustMap((url) => {
                return of(
                  StoreItemActions.runOperationWithTool.success({
                    taskID,
                    operationID,
                    mode,
                    url,
                    audioFile: task.files.find((a) => a.type.includes('audio')) as StoreAudioFile,
                    language,
                    operationName,
                  }),
                );
              }),
            );
          } else {
            return of(
              StoreItemActions.runOperationWithTool.fail({
                error: "Can't find audio file.",
              }),
            );
          }
        },
      ),
    ),
  );

  toolDataReceived$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.receiveToolData.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [OctraWindowMessageEventData, RootState]) => {
        // TODO upload does not work after tool data received
        const currentMode = state.modes.entities[state.modes.currentMode];
        const openedTool = currentMode!.openedTool!;
        const toolName = openedTool?.operationName;
        const task = getOneTaskItemWhereRecursive((item) => item.id === openedTool.taskID!, currentMode!.items)!;

        if (toolName === 'OCTRA') {
          const result: any = action.data?.annotation;
          let annotation: IFile | undefined;

          try {
            const converter = new AnnotJSONConverter();
            const audio = task.files.find((a) => a.type.includes('audio')) as StoreAudioFile;
            const audiofile = new OAudiofile();
            audiofile.url = audio.url;
            audiofile.name = audio.name;
            audiofile.type = audio.type;
            audiofile.size = audio.size;
            audiofile.duration = audio.duration;
            audiofile.sampleRate = audio.sampleRate;
            const importResult = converter.import(result, audiofile);

            if (importResult.annotjson && !importResult.error) {
              const exportConverter = new PartiturConverter();
              const oAnnotJSON = OAnnotJSON.deserialize(importResult.annotjson);
              const exportResult = exportConverter.export(oAnnotJSON!, audiofile, 0);

              if (exportResult.file && !exportResult.error) {
                annotation = exportResult.file;
              } else {
                return of(
                  StoreItemActions.receiveToolData.fail({
                    error: `Export: ${exportResult.error}`,
                  }),
                );
              }
            } else {
              return of(
                StoreItemActions.receiveToolData.fail({
                  error: `Import: ${importResult.error}`,
                }),
              );
            }
          } catch (e) {
            return of(
              StoreItemActions.receiveToolData.fail({
                error: `Converting to TextGrid failed!`,
              }),
            );
          }

          if (!annotation) {
            return of(
              StoreItemActions.receiveToolData.fail({
                error: 'Annotation is undefined.',
              }),
            );
          }

          const blob = new File([annotation.content], annotation.name, {
            type: annotation?.type,
          });
          const file = new TPortalFileInfo(annotation.name, annotation.type, blob.size, blob);
          const audioFile = task?.files.find((a) => a.type.includes('audio')) as StoreAudioFile;
          const name = (audioFile.attributes?.originalFileName ?? audioFile.name).replace(/\.[^.]+$/g, '');

          file.attributes = {
            originalFileName: `${name}${file.extension}`,
          };

          return from(convertFileInfoToStoreFile(file)).pipe(
            exhaustMap((storeFile) =>
              of(
                StoreItemActions.receiveToolData.prepare({
                  mode: state.modes.currentMode,
                  file: storeFile,
                }),
              ),
            ),
          );
        } else if (toolName === 'Emu WebApp') {
          const inputs = task.files;
          const audioFile = inputs.find((a) => a.type.includes('audio')) as StoreAudioFile;
          const fileName = (audioFile.attributes?.originalFileName ?? audioFile.name).replace(/\.[^.]+$/g, '');
          let jsonText = '';

          if (action.data?.annotation) {
            const json = JSON.parse(action.data.annotation.content);
            json.name = fileName;
            json.annotates = `${fileName}_annot.json`;
            jsonText = JSON.stringify(json, null, 2);
          }

          const file: File = TPortalFileInfo.getFileFromContent(jsonText, `${fileName}_annot.json`, 'text/plain');
          const fileInfo = new TPortalFileInfo(`${fileName}_annot.json`, 'text/plain', file.size, file, Date.now());

          fileInfo.attributes = {
            originalFileName: `${fileName}_annot.json`,
          };

          fileInfo.online = false;
          return from(convertFileInfoToStoreFile(fileInfo)).pipe(
            exhaustMap((storeFile) =>
              of(
                StoreItemActions.receiveToolData.prepare({
                  mode: state.modes.currentMode,
                  file: storeFile,
                }),
              ),
            ),
          );
        }
        return of(
          StoreItemActions.receiveToolData.fail({
            error: "Can't find proper operation for selected tool.",
          }),
        );
      }),
    ),
  );

  prepareToolOperation$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.receiveToolData.prepare),
      withLatestFrom(this.store),
      exhaustMap(
        ([action, state]: [
          {
            file: StoreFile;
          },
          RootState,
        ]) =>
          of(
            StoreItemActions.receiveToolData.success({
              mode: state.modes.currentMode,
              taskID: state.modes.entities[state.modes.currentMode]!.openedTool!.taskID,
              file: action.file,
            }),
          ),
      ),
    ),
  );

  receiveToolDataSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.processStoreItem.success),
      withLatestFrom(this.store),
      exhaustMap(
        ([action, state]: [
          {
            id: number;
            mode: TPortalModes;
          },
          RootState,
        ]) =>
          of(
            IDBActions.saveTask.do({
              mode: state.modes.currentMode,
              taskID: action.id,
            }),
          ),
      ),
    ),
  );

  runNextOperationAfterToolDataReceiveSuccess = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.receiveToolData.success),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ mode, taskID, file }, state]: [
          {
            mode: TPortalModes;
            taskID: number;
            file: StoreFile;
          },
          RootState,
        ]) => {
          const currentModeState = state.modes.entities[mode]!;
          const openedTool = currentModeState.openedTool!;
          const task = getOneTaskItemWhereRecursive((item) => item.id === openedTool.taskID, currentModeState.items)!;
          let operation = task.operations!.find((a) => a.id === openedTool.operationID)!;

          operation = {
            ...operation,
            rounds: [
              ...operation.rounds.slice(0, operation.rounds.length - 1),
              {
                ...operation.rounds[operation.rounds.length - 1],
                results: [...operation.rounds[operation.rounds.length - 1].results, file],
                status: TaskStatus.FINISHED,
              },
            ],
          };

          return of(
            StoreItemActions.processNextOperation.success({
              mode,
              taskID,
              operation,
            }),
          );
        },
      ),
    ),
  );

  checkAudioFileCompatibility(audioInfo: StoreAudioFile, asrName?: string, services?: ServiceProvider[]) {
    if (!asrName || !services) {
      return [];
    }

    const result: CompatibleResult[] = [];
    const serviceInfo = services.find((a) => a.provider === asrName);

    if (serviceInfo && audioInfo && audioInfo.type.includes('audio')) {
      if (serviceInfo.maxSignalDuration) {
        if (audioInfo.duration / audioInfo.sampleRate > serviceInfo.maxSignalDuration) {
          result.push({
            name: 'Signal duration',
            isValid: false,
            value: `max ${serviceInfo.maxSignalDuration} seconds`,
          });
        } else {
          result.push({
            name: 'Signal duration',
            isValid: true,
            value: `max ${serviceInfo.maxSignalDuration} seconds`,
          });
        }
      }

      if (serviceInfo.maxSignalSize) {
        if (audioInfo.size / 1000 / 1000 > serviceInfo.maxSignalSize) {
          result.push({
            name: 'Signal length',
            isValid: false,
            value: `${serviceInfo.maxSignalSize} MB`,
          });
        } else {
          result.push({
            name: 'Signal length',
            isValid: true,
            value: `${serviceInfo.maxSignalSize} MB`,
          });
        }
      }
    }

    return result;
  }
}
