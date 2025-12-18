import { inject, Injectable } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { Store } from '@ngrx/store';
import { Table } from 'dexie';
import { DateTime } from 'luxon';
import { catchError, exhaustMap, from, map, of, tap, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AppInfo } from '../../app.info';
import { IDBFolderItem, IDBInternItem, IDBTaskItem, IDBUserDefaultSettingsItemData, IDBUserSettingsItem, IndexedDBManager } from '../../indexedDB';
import { RootState } from '../app';
import { AppActions } from '../app/app.actions';
import { ExternalInformationActions } from '../external-information/external-information.actions';
import { TPortalModes } from '../mode';
import { ModeActions } from '../mode/mode.actions';
import { convertStoreItemToIDBItem } from '../operation/operation.functions';
import { StoreItem } from '../store-item';
import { StoreItemActions } from '../store-item/store-item.actions';
import { getStoreItemsWhereRecursive } from '../store-item/store-item.functions';
import { IDBActions } from './idb.actions';

const taskAdapter: EntityAdapter<StoreItem> = createEntityAdapter<StoreItem>({
  selectId: (task) => task.id,
});

@Injectable()
export class IDBEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private sanitizer = inject(DomSanitizer);
  private _idbm!: IndexedDBManager;

  idbInit$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ExternalInformationActions.loadExternInformation.success),
        tap(() => {
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
      }),
    ),
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

  saveDefaultUserSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.setDefaultSettings.do),
      withLatestFrom(this.store),
      exhaustMap(([{ defaultUserSettings }]) => {
        const value: IDBUserDefaultSettingsItemData = {
          asrLanguage: defaultUserSettings.selectedASRLanguage,
          asrProvider: defaultUserSettings.selectedASRProvider?.provider,
          mausLanguage: defaultUserSettings.selectedMausLanguage,
          summarizationProvider: defaultUserSettings.selectedSummarizationProvider?.provider,
          diarization: defaultUserSettings.isDiarizationEnabled,
          diarizationSpeakers: defaultUserSettings.diarizationSpeakers,
          translationLanguage: defaultUserSettings.selectedTranslationLanguage,
        };
        return from(
          this._idbm.userSettings.put({
            name: 'defaultUserSettings',
            value,
          }),
        ).pipe(
          exhaustMap(() => of(IDBActions.saveDefaultUserSettings.success())),
          catchError((err) =>
            of(
              IDBActions.saveDefaultUserSettings.fail({
                error: typeof err === 'string' ? err : err.message,
              }),
            ),
          ),
        );
      }),
    ),
  );

  saveUserProfile$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.saveUserProfile.do),
      exhaustMap((action) =>
        from(
          this._idbm.userSettings.put({
            name: 'userProfile',
            value: {
              name: action.name,
              email: action.email,
            },
          }),
        ).pipe(
          exhaustMap(() => {
            return of(AppActions.saveUserProfile.success());
          }),
          catchError((err) =>
            of(
              IDBActions.saveDefaultUserSettings.fail({
                error: typeof err === 'string' ? err : err.message,
              }),
            ),
          ),
        ),
      ),
    ),
  );

  saveNotificationEnabled$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.changeNotificationEnabled.do),
      withLatestFrom(this.store),
      exhaustMap(([{ enabled }, state]) => {
        return from(
          this._idbm.userSettings.put({
            name: 'notification',
            value: {
              enabled,
            },
          }),
        ).pipe(
          map(() => IDBActions.saveNotificationEnabled.success()),
          catchError((err) =>
            of(
              IDBActions.saveNotificationEnabled.fail({
                error: typeof err === 'string' ? err : err.message,
              }),
            ),
          ),
        );
      }),
    ),
  );

  saveSidebarWidth$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.changeSidebarWidth.do),
      withLatestFrom(this.store),
      exhaustMap(([{ sidebarWidth }, state]) => {
        return from(
          this._idbm.userSettings.put({
            name: 'sidebarWidth',
            value: sidebarWidth,
          }),
        ).pipe(
          map(() => IDBActions.saveSidebarWidth.success()),
          catchError((err) =>
            of(
              IDBActions.saveSidebarWidth.fail({
                error: typeof err === 'string' ? err : err.message,
              }),
            ),
          ),
        );
      }),
    ),
  );

  saveAccessCode = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.changeAccessCode.do),
      withLatestFrom(this.store),
      exhaustMap(([{ accessCode }, state]) => {
        return from(
          this._idbm.userSettings.put({
            name: 'accessCode',
            value: accessCode,
          }),
        ).pipe(
          map(() => IDBActions.saveAccessCode.success()),
          catchError((err) =>
            of(
              IDBActions.saveAccessCode.fail({
                error: typeof err === 'string' ? err : err.message,
              }),
            ),
          ),
        );
      }),
    ),
  );

  saveTask$ = createEffect(() =>
    this.actions$.pipe(
      ofType(
        StoreItemActions.changeOperation.do,
        StoreItemActions.changeTaskStatus.do,
        IDBActions.saveTask.do,
        StoreItemActions.processNextOperation.success,
        StoreItemActions.processNextOperation.fail,
      ),
      withLatestFrom(this.store),
      exhaustMap(([{ mode, taskID }, state]: [{ mode: TPortalModes; taskID: number }, RootState]) => {
        const table: Table<IDBTaskItem | IDBFolderItem, number, IDBTaskItem | IDBFolderItem> =
          mode === 'annotation' ? this._idbm.annotation_tasks : this._idbm.summarization_tasks;
        const task = getStoreItemsWhereRecursive((item) => item.id === taskID, state.modes.entities[mode]!.items)[0];
        return from(convertStoreItemToIDBItem(task, state.modes.entities[mode]!.defaultOperations!)).pipe(
          exhaustMap((idbTask) => {
            return from(table.put(idbTask, task.id)).pipe(
              exhaustMap(() => {
                return of(
                  IDBActions.saveTask.success({
                    mode,
                    taskID,
                  }),
                );
              }),
              catchError((err) => {
                console.error(err);
                return of(
                  IDBActions.saveTask.fail({
                    error: typeof err === 'string' ? err : err?.message,
                  }),
                );
              }),
            );
          }),
          catchError((err) => {
            console.error(err);
            return of(
              IDBActions.saveTask.fail({
                error: typeof err === 'string' ? err : err?.message,
              }),
            );
          }),
        );
      }),
    ),
  );

  saveRemovedTask$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.removeTaskOrFolder.do),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ item }, state]: [
          {
            item: StoreItem;
          },
          RootState,
        ]) => {
          const table = state.modes.currentMode === 'annotation' ? this._idbm.annotation_tasks : this._idbm.summarization_tasks;
          return from(table.delete(item.id)).pipe(
            exhaustMap(() => of(IDBActions.saveRemovedTasksOrFolder.success())),
            catchError((err) =>
              of(
                IDBActions.saveRemovedTasksOrFolder.fail({
                  error: typeof err === 'string' ? err : err?.message,
                }),
              ),
            ),
          );
        },
      ),
    ),
  );

  saveRemovedStoreItems = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.removeStoreItems.do),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ ids }, state]: [
          {
            ids: number[];
          },
          RootState,
        ]) => {
          const table = state.modes.currentMode === 'annotation' ? this._idbm.annotation_tasks : this._idbm.summarization_tasks;
          return from(table.bulkDelete(ids)).pipe(
            exhaustMap(() => of(IDBActions.saveRemovedStoreItems.success())),
            catchError((err) =>
              of(
                IDBActions.saveRemovedStoreItems.fail({
                  error: typeof err === 'string' ? err : err?.message,
                }),
              ),
            ),
          );
        },
      ),
    ),
  );

  saveSelectedStoreItems$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.removeAppendingForSelectedItems.do),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        return of(
          IDBActions.saveStoreItems.do({
            mode: state.modes.currentMode,
            itemIDs: getStoreItemsWhereRecursive((item) => item.selected === true, state.modes.entities[state.modes.currentMode]!.items).map(
              (a) => a.id,
            ),
          }),
        );
      }),
    ),
  );

  saveTasksAfterOptionsOnQueuedChanged$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.markValidQueuedTasksAsPending.success),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) =>
        of(
          IDBActions.saveStoreItems.do({
            mode: state.modes.currentMode,
            itemIDs: action.itemIDs,
          }),
        ),
      ),
    ),
  );

  saveTasksAfterMarkedAsPending$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.markValidQueuedTasksAsPending.success),
      withLatestFrom(this.store),
      exhaustMap(([action, state]) =>
        of(
          IDBActions.saveStoreItems.do({
            mode: state.modes.currentMode,
            itemIDs: action.itemIDs,
          }),
        ),
      ),
    ),
  );

  saveStoreItems$ = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.saveStoreItems.do),
      withLatestFrom(this.store),
      exhaustMap(
        ([{ itemIDs, mode }, state]: [
          {
            mode: TPortalModes;
            itemIDs: number[];
          },
          RootState,
        ]) => {
          return from(
            (async () => {
              const serialized: (IDBTaskItem | IDBFolderItem)[] = [];
              const items = getStoreItemsWhereRecursive((item) => itemIDs.includes(item.id), state.modes.entities[mode]!.items);
              for (const item of items) {
                serialized.push(await convertStoreItemToIDBItem(item, state.modes.entities[mode]!.defaultOperations));
              }

              return serialized;
            })(),
          ).pipe(
            exhaustMap((serializedItems) => {
              return from(this._idbm[`${mode}_tasks`].bulkPut(serializedItems)).pipe(
                () => of(IDBActions.saveStoreItems.success()),
                catchError((err) =>
                  of(
                    IDBActions.saveStoreItems.fail({
                      error: typeof err === 'string' ? err : err.message,
                    }),
                  ),
                ),
              );
            }),
          );
        },
      ),
    ),
  );

  saveEntriesAfterPreprocessing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.importItemsFromProcessingQueue.success),
      withLatestFrom(this.store),
      exhaustMap(([action]) => {
        return of(
          IDBActions.saveStoreItems.do({
            mode: action.mode,
            itemIDs: action.addedItemIDs,
          }),
        );
      }),
    ),
  );

  saveCountersAfterPreprocessing$ = createEffect(() =>
    this.actions$.pipe(
      ofType(StoreItemActions.importItemsFromProcessingQueue.success),
      withLatestFrom(this.store),
      exhaustMap(() => {
        return of(IDBActions.saveCounters.do());
      }),
    ),
  );

  saveCounters$ = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.saveCounters.do),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) =>
        from(
          this._idbm.intern.bulkPut([
            {
              name: 'taskCounter',
              value: state.modes.counters.storeItem,
            },
            {
              name: 'operationCounter',
              value: state.modes.counters.operation,
            },
          ]),
        ).pipe(
          exhaustMap(() => of(IDBActions.saveCounters.success())),
          catchError((err) =>
            of(
              IDBActions.saveCounters.fail({
                error: typeof err === 'string' ? err : err?.message,
              }),
            ),
          ),
        ),
      ),
    ),
  );

  clearDatabase$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(IDBActions.clearDatabase.do),
        tap(async () => {
          await this._idbm.delete({
            disableAutoOpen: true,
          });
          window.location.reload();
        }),
      ),
    { dispatch: false },
  );

  backupDatabase = createEffect(() =>
    this.actions$.pipe(
      ofType(IDBActions.backupDatabase.do),
      exhaustMap(() =>
        from(this._idbm.backup()).pipe(
          exhaustMap((url) => {
            return of(
              IDBActions.backupDatabase.success({
                url,
                safeURL: this.sanitizer.bypassSecurityTrustResourceUrl(url),
                filename: `tportal_backup_${DateTime.now().toISO()}.idb`,
              }),
            );
          }),
          catchError((error) => {
            return of(
              IDBActions.backupDatabase.fail({
                error: error?.message,
              }),
            );
          }),
        ),
      ),
    ),
  );

  restoreDatabase$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(IDBActions.restoreDatabase.do),
        tap(async (action) => {
          await this._idbm.importBackup(action.blob);
        }),
      ),
    { dispatch: false },
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
