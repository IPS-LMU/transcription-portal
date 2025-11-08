import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { VersionCheckerService } from '@octra/ngx-components';
import { exhaustMap, map, of, withLatestFrom } from 'rxjs';
import { PortalModeType } from '../../obj/tasks/task.service';
import { RootState } from '../app';
import { ModeActions } from '../mode/mode.actions';

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

  updateProtocolURL$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.initModes.do),
      map(() => {
        return ModeActions.updateProtocolURL.do();
      }),
    ),
  );

  updateProtocolURLSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.updateProtocolURL.do),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        const protocol = {
          version: '2.0.0',
          modes: [],
        };
        for (const mode of ['annotation', 'summarization'] as PortalModeType[]) {
          const protocolMode = {
            name: mode,
            tasks: [],
          };
          const affectedMode = state.modes.entities[mode];
          if (state.app.protocolURL) {
            URL.revokeObjectURL(state.app.protocolURL);
          } /*

          const test = forkJoin(affectedMode?.tasks.entities ?? [])
          const promises: Promise<any>[] = [];
          for (const entry of affectedMode.taskList.entries) {
            promises.push(entry.toAny());
          }

          Promise.all(promises)
            .then((values) => {
              const json = {
                version: '1.0.0',
                encoding: 'UTF-8',
                created: DateTime.now().toISO(),
                entries: values,
              };

              affectedMode.protocolFileName = `oh_portal_${mode}_${DateTime.now().toISO()}.json`;
              const file = new File([JSON.stringify(json, null, 2)], affectedMode.protocolFileName, {
                type: 'text/plain',
              });

              const url = URL.createObjectURL(file);
              affectedMode.protocolURL = this.sanitizer.bypassSecurityTrustResourceUrl(url);
              resolve(affectedMode.protocolURL);
            })
            .catch((error) => {
              reject(error);
            });
            */
        }

        return of(ModeActions.updateProtocolURL.success());
      }),
    ),
  );
}
