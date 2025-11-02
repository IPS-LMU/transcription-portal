import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, from, of, withLatestFrom } from 'rxjs';
import { Operation } from '../../obj/operations/operation';
import { TaskEntry } from '../../obj/tasks/task-entry';
import { TaskService } from '../../obj/tasks/task.service';
import { RootState } from '../app';
import { IDBActions, IDBLoadedResults } from '../idb';
import { TaskActions } from './task.actions';
import { SplitModalComponent } from '../../modals/split-modal/split-modal.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

@Injectable()
export class TaskEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private taskService = inject(TaskService);
  protected ngbModalService = inject(NgbModal);

  initTasks$ = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.initIDB.loaded),
      withLatestFrom(this.store),
      exhaustMap(([{ intern, annotationTasks, summarizationTasks, userSettings }, state]: [IDBLoadedResults, RootState]) => {
        const taskCounter = intern?.find((a) => a.name === 'taskCounter')?.value ?? 0;
        const operationCounter = intern?.find((a) => a.name === 'operationCounter')?.value ?? 0;
        TaskEntry.counter = taskCounter.value;
        Operation.counter = operationCounter.value;

        this.taskService.init();
        this.taskService.accessCode = userSettings.find((a) => a.name === 'accessCode')?.value;
        this.taskService.openSplitModal = this.openSplitModal;

        return from(
          this.taskService.importDBData({
            annotationTasks,
            summarizationTasks,
            userSettings,
          }),
        ).pipe(
          exhaustMap(() => {
            return of(TaskActions.importTasks.success());
          }),
          catchError((error) => {
            console.error(error);
            return of(
              TaskActions.importTasks.fail({
                error: typeof error === 'string' ? error : error.message,
              }),
            );
          }),
        );
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
