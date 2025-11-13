import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { SubscriptionManager } from '@octra/utilities';
import { exhaustMap, of, Subscription, tap, withLatestFrom } from 'rxjs';
import { SplitModalComponent } from '../../modals/split-modal/split-modal.component';
import { TaskStatus } from '../../obj/tasks';
import { TaskService } from '../../obj/tasks/task.service';
import { RootState } from '../app';
import { IDBActions, IDBLoadedResults } from '../idb/idb.actions';
import { taskAdapter, TPortalModes } from '../mode';
import { StoreTaskOperation } from '../operation';
import { getLastOperationRound } from '../operation/operation.functions';
import { PreprocessingActions } from '../preprocessing/preprocessing.actions';
import { StoreItemActions } from './store-item.actions';
import { getOneTaskItemWhereRecursive } from './store-item.functions';

@Injectable()
export class StoreItemEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private taskService = inject(TaskService);
  protected ngbModalService = inject(NgbModal);
  protected httpClient = inject(HttpClient);

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
                  id: taskID,
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

  public openSplitModal = () => {
    const ref = this.ngbModalService.open(SplitModalComponent, SplitModalComponent.options);
    ref.result.then((reason) => {
      this.taskService.splitPrompt = reason;
      this.taskService.checkFiles(this.taskService.state.currentMode);
    });
  };
}
