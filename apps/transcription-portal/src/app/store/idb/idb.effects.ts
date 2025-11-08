import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { catchError, exhaustMap, from, of, tap, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppInfo } from '../../app.info';
import { IDBInternItem, IDBTaskItem, IDBUserSettingsItem, IndexedDBManager } from '../../indexedDB';
import { RootState } from '../app';
import { StoreItemActions } from '../store-item/store-item.actions';
import { IDBActions } from './idb.actions';
import { AppActions } from '../app/app.actions';

@Injectable()
export class IDBEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private _idbm!: IndexedDBManager;

  // TODO move to other class
  private userProfile = {
    name: '',
    email: '',
  };

  idbInit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.loadSettings.success),
        withLatestFrom(this.store),
        tap(([, state]: [any, RootState]) => {
          this._idbm = new IndexedDBManager(environment.development ? 'oh-portal-dev' : 'oh-portal');
          this._idbm.on('ready', async () => {
            this.store.dispatch(IDBActions.initIDB.ready());
          });
          from(this._idbm.open()).pipe(
            catchError((err: any) => {
              this.store.dispatch(
                IDBActions.initIDB.fail({
                  error: typeof err === 'string' ? err : err?.message,
                }),
              );
              return of();
            }),
          );
        }),
      ),
    { dispatch: false },
  );

  dbReady$ = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.initIDB.ready),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        console.log('IDB ready.');
        return from(this.loadIDB()).pipe(
          exhaustMap(([intern, annotationTasks, summarizationTasks, userSettings]) => {
            if (userSettings) {
              const userProfile = userSettings.find((a: any) => {
                return a.name === 'userProfile';
              });

              if (userProfile && userProfile.value) {
                this.userProfile = userProfile.value;
              }
            }

            return of(
              IDBActions.initIDB.loaded({
                intern,
                annotationTasks,
                summarizationTasks,
                userSettings,
              }),
            );
          }),
          catchError((err) => {
            console.error(err);
            return of(
              IDBActions.initIDB.fail({
                error: typeof err === 'string' ? err : err?.message,
              }),
            );
          }),
        );
      }),
    ),
  );

  tasksLoaded$ = createEffect(() =>
      this.actions$.pipe(
        ofType(StoreItemActions.importTasks.success),
        withLatestFrom(this.store),
        exhaustMap(([action, state]) => {
          return of(IDBActions.initIDB.success());
        })
      )
  );

  idbInitFail$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.importTasks.fail),
      withLatestFrom(this.store),
      exhaustMap(([action]) => {
        return of(IDBActions.initIDB.fail({ error: action.error }));
      }),
    ),
  );

  saveInternValues$ = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.saveInternValues.do),
      withLatestFrom(this.store),
      exhaustMap(([action]) => {
        return from(this._idbm.intern.bulkPut(action.items)).pipe(
          exhaustMap(() => {
            return of(
              IDBActions.saveInternValues.success({
                items: action.items,
              }),
            );
          }),
          catchError((err) => {
            return of(IDBActions.saveInternValues.fail({ error: typeof err === 'string' ? err : err.message }));
          }),
        );
      }),
    ),
  );

  private loadIDB = async () => {
    await this._idbm.intern.put({
      name: 'version',
      value: AppInfo.version,
    });

    const promises: Promise<any>[] = [];
    promises.push(this._idbm.intern.toArray());
    promises.push(this._idbm.annotation_tasks.toArray());
    promises.push(this._idbm.summarization_tasks.toArray());
    promises.push(this._idbm.userSettings.toArray());

    return Promise.all<[IDBInternItem[], IDBTaskItem[], IDBTaskItem[], IDBUserSettingsItem<any>[]]>(promises as any);
  };
}
