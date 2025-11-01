import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { VersionCheckerService } from '@octra/ngx-components';
import { DateTime } from 'luxon';
import { catchError, exhaustMap, forkJoin, map, of, withLatestFrom } from 'rxjs';
import { RootState } from '../app';
import { ModeActions } from '../mode/mode.actions';
import { convertStoreItemToIDBItem } from '../operation/operation.functions';
import { StoreItem } from '../store-item';
import { getAllTasks } from './mode.functions';

@Injectable()
export class ModeEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  versionChecker = inject(VersionCheckerService);

  initModes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.initModes.do),
      map(() => {
        return ModeActions.initModes.success();
      }),
    ),
  );

  updateProtocolURLSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.updateProtocolURL.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) => {
        const affectedMode = state.modes.entities[state.modes.currentMode]!;
        return forkJoin(
          getAllTasks(affectedMode?.items ?? []).map((item: StoreItem) => convertStoreItemToIDBItem(item, affectedMode.defaultOperations)),
        ).pipe(
          exhaustMap((values) => {
            const json = {
              version: '2.0.0',
              encoding: 'UTF-8',
              created: DateTime.now().toISO(),
              mode: state.modes.currentMode,
              entries: values,
            };

            const fileName = `transcription_portal_${action.mode}_${DateTime.now().toISO()}.json`;
            const file = new File([JSON.stringify(json, null, 2)], fileName, {
              type: 'text/plain',
            });

            const url = URL.createObjectURL(file);
            return of(
              ModeActions.updateProtocolURL.success({
                url,
                fileName,
              }),
            );
          }),
          catchError((err) =>
            of(
              ModeActions.updateProtocolURL.fail({
                error: err.message,
              }),
            ),
          ),
        );
      }),
    ),
  );

  defaultOptionsEnabledChanged$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.setDefaultOperationEnabled.do),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        return of(
          ModeActions.setDefaultOperationEnabled.success({
            defaultOptions: state.modes.entities[state.modes.currentMode]!.defaultOperations,
          }),
        );
      }),
    ),
  );
}
