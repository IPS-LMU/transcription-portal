import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { IFile } from '@octra/annotation';
import { DirectoryInfo, FileInfo } from '@octra/web-media';
import { catchError, exhaustMap, from, map, mergeMap, of, tap, withLatestFrom } from 'rxjs';
import { AlertService } from '../../shared/alert.service';
import { RootState } from '../app';
import { TPortalModes } from '../mode';
import { convertInfoFileItemToStoreFileItem, StoreAudioFile, StoreFile, StoreFileDirectory } from '../store-item';
import { PreprocessingActions } from './preprocessing.actions';
import { cleanUpInputArray, processFileOrDirectoryInfo } from './preprocessing.functions';
import { ProcessingQueueStatus } from './preprocessing.state';

@Injectable()
export class PreprocessingEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private alertService = inject(AlertService);

  itemsAdded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreprocessingActions.addToQueue.do),
      withLatestFrom(this.store),
      exhaustMap(([{ infoItems }, state]: [{ infoItems: (FileInfo | DirectoryInfo<any>)[] }, RootState]) =>
        of(
          PreprocessingActions.addToQueue.filter({
            mode: state.modes.currentMode,
            infoItems,
          }),
        ),
      ),
    ),
  );

  itemsFiltered$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreprocessingActions.addToQueue.filter),
      withLatestFrom(this.store),
      exhaustMap(([{ mode, infoItems }]: [{ infoItems: (FileInfo | DirectoryInfo<any>)[]; mode: TPortalModes }, RootState]) => {
        const result = cleanUpInputArray(infoItems);

        const promises: Promise<StoreFile | StoreAudioFile | StoreFileDirectory>[] = result.filteredItems.map((a: FileInfo | DirectoryInfo<any>) =>
          convertInfoFileItemToStoreFileItem(a),
        );
        return from(Promise.all(promises)).pipe(
          exhaustMap((filteredItems: (StoreFile | StoreAudioFile | StoreFileDirectory)[]) =>
            of(
              PreprocessingActions.addToQueue.checkFiltered({
                unsupportedFiles: result.unsupportedFiles,
                filteredItems,
                mode,
              }),
            ),
          ),
        );
      }),
    ),
  );

  filteredItemsAdded$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreprocessingActions.addToQueue.checkFiltered),
      withLatestFrom(this.store),
      exhaustMap(([{ mode }]: [{ mode: TPortalModes }, RootState]) => of(PreprocessingActions.processQueueItem.next({ mode }))),
    ),
  );

  unsupportedItemsAdded$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(PreprocessingActions.addToQueue.checkFiltered),
        withLatestFrom(this.store),
        tap(([{ unsupportedFiles }]: [{ unsupportedFiles: IFile[] }, RootState]) => {
          if (unsupportedFiles.length > 0) {
            this.alertService.showAlert(
              'warning',
              `<b>${unsupportedFiles.length}</b> unsupported file(s) were ignored. Only WAVE audio files and transcript formats are supported.`,
            );
          }
        }),
      ),
    { dispatch: false },
  );

  processNextItems$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(PreprocessingActions.processQueueItem.next),
        withLatestFrom(this.store),
        tap(([{ mode }, state]: [{ mode: TPortalModes }, RootState]) => {
          const preprocessingState = state.modes.entities[mode]!.preprocessor;
          const queueItems = preprocessingState.ids.map((a) => preprocessingState.entities[a]).filter((a) => a !== undefined);
          const runningQueueItems = queueItems.filter((a) => a.status === ProcessingQueueStatus.PROCESSING);

          if (runningQueueItems.length === 0) {
            const nextPendingItem = queueItems.find((a) => a?.status === ProcessingQueueStatus.PENDING);

            if (nextPendingItem) {
              // run next item
              this.store.dispatch(
                PreprocessingActions.processQueueItem.do({
                  id: nextPendingItem.id,
                  mode,
                }),
              );
            }
          }
        }),
      ),
    { dispatch: false },
  );

  processItem$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreprocessingActions.processQueueItem.do),
      withLatestFrom(this.store),
      mergeMap(([{ mode, id }, state]: [{ mode: TPortalModes; id: number }, RootState]) => {
        const preprocessingState = state.modes.entities[mode]!.preprocessor;
        const item = preprocessingState.entities[id];

        if (item) {
          return from(processFileOrDirectoryInfo(item.infoItem, '', item, state.modes.entities[mode]!)).pipe(
            map((results) =>
              PreprocessingActions.processQueueItem.success({
                id,
                results,
                mode,
              }),
            ),
            catchError((err) => {
              return of(
                PreprocessingActions.processQueueItem.fail({
                  error: typeof err === 'string' ? err : err.message,
                }),
              );
            }),
          );
        } else {
          return of(
            PreprocessingActions.processQueueItem.fail({
              error: `Can't process queue item with id ${id}: Not found.`,
            }),
          );
        }
      }),
    ),
  );

  itemProcessed$ = createEffect(() =>
    this.actions$.pipe(
      ofType(PreprocessingActions.processQueueItem.success),
      withLatestFrom(this.store),
      exhaustMap(([{ mode }, state]: [{ mode: TPortalModes }, RootState]) => {
        return of(PreprocessingActions.processQueueItem.next({ mode }));
      }),
    ),
  );
}
