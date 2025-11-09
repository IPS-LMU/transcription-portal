import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { exhaustMap, of, tap, withLatestFrom } from 'rxjs';
import { SplitModalComponent } from '../../modals/split-modal/split-modal.component';
import { TaskService } from '../../obj/tasks/task.service';
import { RootState } from '../app';
import { IDBActions, IDBLoadedResults } from '../idb/idb.actions';
import { PreprocessingActions } from '../preprocessing/preprocessing.actions';
import { StoreItemActions } from './store-item.actions';

@Injectable()
export class StoreItemEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private taskService = inject(TaskService);
  protected ngbModalService = inject(NgbModal);

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

  public openSplitModal = () => {
    const ref = this.ngbModalService.open(SplitModalComponent, SplitModalComponent.options);
    ref.result.then((reason) => {
      this.taskService.splitPrompt = reason;
      this.taskService.checkFiles(this.taskService.state.currentMode);
    });
  };
}
