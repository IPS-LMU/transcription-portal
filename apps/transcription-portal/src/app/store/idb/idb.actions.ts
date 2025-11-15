import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBInternItem, IDBTaskItem, IDBUserSettingsItem } from '../../indexedDB';
import { TPortalModes } from '../mode';

export interface IDBLoadSuccessResults{
  annotationTasks: IDBTaskItem[];
  summarizationTasks: IDBTaskItem[];
  userSettings: IDBUserSettingsItem<any>[];
}

export interface IDBLoadedResults {
  intern: IDBInternItem[];
  annotationTasks: IDBTaskItem[],
  summarizationTasks: IDBTaskItem[],
  userSettings: IDBUserSettingsItem<any>[]
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
          items: IDBInternItem[]
        }>(),
        success: props<{
          items: IDBInternItem[]
        }>(),
        fail: props<{
          error: string;
        }>(),
      }
  });


  static saveDefaultUserSettings = createActionGroup({
      source: 'idb/save default user settings',
      events: {
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

  static saveNotificationEnabled = createActionGroup({
      source: 'idb/save notification enabled',
      events: {
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

  static saveSidebarWidth = createActionGroup({
      source: 'idb/save sidebar width',
      events: {
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

  static saveAccessCode = createActionGroup({
    source: 'idb/save access code',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    }
  });

  static saveRemovedTasksOrFolder = createActionGroup({
    source: 'idb/save removed task or folder',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    }
  });

  static saveRemovedStoreItems = createActionGroup({
    source: 'idb/save removed store items',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    }
  });



  static saveTask = createActionGroup({
    source: 'idb/save task',
    events: {
      success: props<{
        mode: TPortalModes;
        taskID: number,
      }>(),
      fail: props<{
        error: string;
      }>(),
    }
  });

}
