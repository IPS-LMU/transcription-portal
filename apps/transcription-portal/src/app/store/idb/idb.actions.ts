import { SafeUrl } from '@angular/platform-browser';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBInternItem, IDBTaskItem, IDBUserSettingsItem } from '../../indexedDB';
import { TPortalModes } from '../mode';

export interface IDBLoadSuccessResults {
  annotationTasks: IDBTaskItem[];
  summarizationTasks: IDBTaskItem[];
  userSettings: IDBUserSettingsItem<any>[];
}

export interface IDBLoadedResults {
  intern: IDBInternItem[];
  annotationTasks: IDBTaskItem[];
  summarizationTasks: IDBTaskItem[];
  userSettings: IDBUserSettingsItem<any>[];
}

export class IDBActions {
  static initIDB = createActionGroup({
    source: 'idb/init',
    events: {
      ready: emptyProps(),
      loaded: props<IDBLoadedResults>(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveInternValues = createActionGroup({
    source: 'idb/save intern values',
    events: {
      do: props<{
        items: IDBInternItem[];
      }>(),
      success: props<{
        items: IDBInternItem[];
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveDefaultUserSettings = createActionGroup({
    source: 'idb/save default user settings',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveNotificationEnabled = createActionGroup({
    source: 'idb/save notification enabled',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveSidebarWidth = createActionGroup({
    source: 'idb/save sidebar width',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveAccessCode = createActionGroup({
    source: 'idb/save access code',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveRemovedTasksOrFolder = createActionGroup({
    source: 'idb/save removed task or folder',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveRemovedStoreItems = createActionGroup({
    source: 'idb/save removed store items',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveTask = createActionGroup({
    source: 'idb/save task',
    events: {
      do: props<{
        mode: TPortalModes;
        taskID: number;
      }>(),
      success: props<{
        mode: TPortalModes;
        taskID: number;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveStoreItems = createActionGroup({
    source: 'idb/save items',
    events: {
      do: props<{
        mode: TPortalModes;
        itemIDs: number[];
      }>(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static saveCounters = createActionGroup({
    source: 'idb/save counters',
    events: {
      do: emptyProps(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static clearDatabase = createActionGroup({
    source: 'idb/clear database',
    events: {
      do: emptyProps(),
    },
  });

  static backupDatabase = createActionGroup({
    source: 'idb/backup database',
    events: {
      do: emptyProps(),
      success: props<{
        url: string;
        safeURL: SafeUrl;
        filename: string;
      }>(),
      fail: props<{
        error: string;
      }>(),
      revoke: emptyProps(),
    },
  });

  static restoreDatabase = createActionGroup({
      source: 'idb/restore database',
      events: {
        do: props<{
          blob: Blob;
        }>(),
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

}
