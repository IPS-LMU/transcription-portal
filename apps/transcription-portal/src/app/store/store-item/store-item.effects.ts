import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { SubscriptionManager } from '@octra/utilities';
import { exhaustMap, from, of, Subscription, tap, withLatestFrom } from 'rxjs';
import { SplitModalComponent } from '../../modals/split-modal/split-modal.component';
import { TaskStatus } from '../../obj/tasks';
import { TaskService } from '../../obj/tasks/task.service';
import { AlertService } from '../../shared/alert.service';
import { RootState } from '../app';
import { IDBActions, IDBLoadedResults } from '../idb/idb.actions';
import { taskAdapter, TPortalModes } from '../mode';
import { OctraOperationFactory, StoreTaskOperation, UploadOperationFactory } from '../operation';
import { getLastOperationResultFromLatestRound, getLastOperationRound } from '../operation/operation.functions';
import { PreprocessingActions } from '../preprocessing/preprocessing.actions';
import { StoreFile } from './store-item';
import { StoreItemActions } from './store-item.actions';
import { getOneTaskItemWhereRecursive, getTaskItemsWhereRecursive } from './store-item.functions';

@Injectable()
export class StoreItemEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private taskService = inject(TaskService);
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

  prepateTasksSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StoreItemActions.prepareTasks.success),
        withLatestFrom(this.store),
        tap(([, state]: [any, RootState]) => {}),
      ),
    {
      dispatch: false,
    },
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
      exhaustMap((action) =>
        of(
          StoreItemActions.importItemsFromProcessingQueue.success({
            id: action.id,
            mode: action.mode,
          }),
        ),
      ),
    ),
  );

  startProcessing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.startProcessing.do),
      withLatestFrom(this.store),
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
        const nextTask = getOneTaskItemWhereRecursive((item) => item.status === TaskStatus.PENDING, state.modes.entities[mode]!.items, taskAdapter);
        if (!nextTask || state.modes.entities[mode]!.statistics.waiting === 0) {
          return of(
            StoreItemActions.processNextStoreItem.nothingToDo({
              mode,
            }),
          );
        }

        return of(StoreItemActions.processStoreItem.do({ id: nextTask.id, mode }));
      }),
    ),
  );

  processStoreItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.processStoreItem.do),
      withLatestFrom(this.store),
      exhaustMap(([{ id, mode }, state]: [{ id: number; mode: TPortalModes }, RootState]) => {
        const currentMode = state.modes.entities[mode]!;
        const defaultOperations = currentMode.defaultOperations;
        const item = getOneTaskItemWhereRecursive((item) => item.id === id, state.modes.entities[mode]!.items, taskAdapter);

        if (!item) {
          return of(
            StoreItemActions.processStoreItem.fail({
              error: `Can't start task ${id}: Not found.`,
            }),
          );
        }

        return of(StoreItemActions.processNextOperation.do({ mode, taskID: item.id }));
      }),
    ),
  );

  processNextOperation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StoreItemActions.processNextOperation.do),
        withLatestFrom(this.store),
        tap(([{ mode, taskID }, state]: [{ mode: TPortalModes; taskID: number }, RootState]) => {
          const currentMode = state.modes.entities[mode]!;
          const defaultOperations = currentMode.defaultOperations;
          const item = getOneTaskItemWhereRecursive((item) => item.id === taskID, state.modes.entities[mode]!.items, taskAdapter);

          if (!item) {
            this.store.dispatch(
              StoreItemActions.processStoreItem.fail({
                error: `Can't process next operation. task ${taskID}: Not found.`,
              }),
            );
            return;
          }

          let lastNonSkippableOperation: StoreTaskOperation | undefined;
          let somethingFound = false;

          for (let i = 0; i < defaultOperations.length; i++) {
            const defaultOperation = defaultOperations[i];
            const operation = item.operations[i];
            const lastRound = getLastOperationRound(operation);

            if (operation.enabled) {
              if (
                lastRound?.status === 'PENDING' &&
                (!lastNonSkippableOperation || getLastOperationRound(lastNonSkippableOperation)?.status === TaskStatus.FINISHED)
              ) {
                if (!['OCTRA', 'Emu WebApp'].includes(defaultOperation.factory.name)) {
                  const opTicket = `task[${taskID}];op[${operation.id}];date[${Date.now()}]`;
                  const opSubscrManager = new SubscriptionManager();
                  this.subscrManager.add(
                    defaultOperation.factory.run(item, operation, this.httpClient, opSubscrManager).subscribe({
                      next: (event) => {
                        this.store.dispatch(
                          StoreItemActions.changeOperation.do({
                            mode,
                            taskID,
                            operation: event.operation,
                          }),
                        );

                        if (getLastOperationRound(event.operation)?.status === 'FINISHED') {
                          this.store.dispatch(
                            StoreItemActions.processNextOperation.success({
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
                            operationID: operation.id,
                            error: typeof err === 'string' ? err : err.message,
                          }),
                        );
                        opSubscrManager.destroy();
                      },
                    }),
                    opTicket,
                  );
                } else {
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
                somethingFound = true;
                break;
              }
              lastNonSkippableOperation = operation;
            }
          }

          if (!somethingFound) {
            if (lastNonSkippableOperation && getLastOperationRound(lastNonSkippableOperation)?.status === 'FINISHED') {
              this.store.dispatch(
                StoreItemActions.processStoreItem.success({
                  mode,
                  id: taskID,
                }),
              );
            } else {
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

  toggleProcessing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.toggleProcessing.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) => {
        const currentMode = state.modes.entities[state.modes.currentMode]!;
        if (currentMode.overallState !== 'not started') {
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
        tap(([{ taskID, operationID }, state]: [{ operationID: number; taskID: number }, RootState]) => {
          // operation is of type tool and ready
          const currentState = state.modes.entities[state.modes.currentMode]!;
          const task = getOneTaskItemWhereRecursive((item) => item.id === taskID, currentState.items, taskAdapter)!;
          const taskOperations = task.operations!;
          const opIndex = taskOperations.findIndex((a) => a.id === operationID)!;
          const { factory } = currentState.defaultOperations[opIndex]!;
          const operation = taskOperations[opIndex];
          const uploadOperation = taskOperations[0];
          const previousOperation = opIndex > 0 ? taskOperations[opIndex - 1] : undefined;
          const availableUploadedAudioFile = getLastOperationRound(uploadOperation)?.results.find((a) => a.type.includes('audio'));
          const droppedAudioFile = task.files!.find((a) => a.type.includes('audio'))?.blob;
          const isPreviousTaskDefinedAndLastResultNotAvailable = previousOperation
            ? !getLastOperationResultFromLatestRound(previousOperation)?.available
            : false;

          if (!availableUploadedAudioFile?.available && !droppedAudioFile) {
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
                  ...operation,
                  rounds: [
                    {
                      ...operation.rounds[0],
                      status: TaskStatus.PENDING,
                    },
                    ...operation.rounds.slice(1),
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
            this.taskService.start(this.taskService.state.currentMode);
          } else if (isPreviousTaskDefinedAndLastResultNotAvailable && previousOperation?.enabled) {
            // audio file available but no result of previous operation
            this.alertService.showAlert('info', `Please run ${previousOperation?.name} for this task again.`, 12);
          } else {
            // audio file exists and last result of previous operation exists
            let file: StoreFile | undefined = undefined;
            if (operation.rounds.length > 0) {
              if (!getLastOperationResultFromLatestRound(operation)?.online && getLastOperationResultFromLatestRound(operation)?.available) {
                // file for last result of current tool exists, but isn't available via URL
                // reupload result from tool operation
                file = getLastOperationResultFromLatestRound(operation);
              }
            } else if (
              previousOperation &&
              getLastOperationRound(previousOperation) &&
              !getLastOperationResultFromLatestRound(previousOperation)?.online &&
              getLastOperationResultFromLatestRound(previousOperation)?.available
            ) {
              // reupload result from previous operation
              // local available, reupload
              file = getLastOperationResultFromLatestRound(previousOperation);
            }

            if (file && operation) {
              this.store.dispatch(
                StoreItemActions.reuploadFile.do({
                  mode: state.modes.currentMode,
                  taskID,
                  operationID,
                  file,
                }),
              );
            } else {
              (factory as OctraOperationFactory).getToolURL(task, operation, this.httpClient).then((url) => {
                this.store.dispatch(
                  StoreItemActions.runOperationWithTool.success({
                    taskID,
                    operationID,
                    mode: state.modes.currentMode,
                    url,
                  }),
                );
              });
            }
          }
        }),
      ),
    { dispatch: false },
  );

  reuploadFile$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(StoreItemActions.reuploadFile.do),
        withLatestFrom(this.store),
        tap(
          ([{ mode, taskID, operationID, roundIndex, file }, state]: [
            {
              mode: TPortalModes;
              taskID: number;
              operationID: number;
              roundIndex?: number;
              file: StoreFile;
            },
            RootState,
          ]) => {
            this.subscrManager.add(
              UploadOperationFactory.upload(
                [file],
                state.app.settings!.api!.commands!.find((a) => a.name === 'Upload')!.calls[0],
                this.httpClient,
              ).subscribe({
                next: (httpEvent) => {
                  if (httpEvent.type === 'loadend') {
                    this.store.dispatch(
                      StoreItemActions.reuploadFile.success({
                        mode,
                        taskID,
                        operationID,
                        roundIndex,
                        file,
                      }),
                    );
                  }
                },
                error: (err: any) => {
                  this.store.dispatch(
                    StoreItemActions.reuploadFile.fail({
                      error: typeof err === 'string' ? err : err?.message,
                    }),
                  );
                },
              }),
            );
          },
        ),
      ),
    { dispatch: false },
  );

  reuploadFileSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.reuploadFile.success),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ mode, taskID, operationID, roundIndex, file }, state]: [
          {
            mode: TPortalModes;
            taskID: number;
            operationID: number;
            roundIndex?: number;
            file: StoreFile;
          },
          RootState,
        ]) => {
          const task = getTaskItemsWhereRecursive((item) => item.id === taskID, state.modes.entities[mode]!.items, taskAdapter)[0];
          const operationIndex = task.operations!.findIndex((a) => a.id === operationID);
          const operation = task.operations![operationIndex];
          const { factory } = state.modes.entities[mode]!.defaultOperations[operationIndex];

          return from((factory as OctraOperationFactory).getToolURL(task, operation, this.httpClient)).pipe(
            exhaustMap((url) => {
              return of(
                StoreItemActions.runOperationWithTool.success({
                  taskID,
                  operationID,
                  mode,
                  url,
                }),
              );
            }),
          );
        },
      ),
    ),
  );

  public openSplitModal = () => {
    const ref = this.ngbModalService.open(SplitModalComponent, SplitModalComponent.options);
    ref.result.then((reason) => {
      this.taskService.splitPrompt = reason;
      this.taskService.checkFiles(this.taskService.state.currentMode);
    });
  };
}
