import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBInternItem, IDBTaskItem, IDBUserSettingsItem } from '../../indexedDB';

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


  static saveDefaultUseSettings = createActionGroup({
      source: 'idb/save default user settings',
      events: {
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

}
