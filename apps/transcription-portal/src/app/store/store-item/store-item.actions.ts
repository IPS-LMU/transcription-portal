import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBTaskItem } from '../../indexedDB';
import { DefaultUserSettings, TPortalModes } from '../mode';
import { StoreAudioFile, StoreFile, StoreFileDirectory, StoreItem, StoreItemTaskOptions } from './store-item';

export class StoreItemActions {
  static importTasks = createActionGroup({
    source: 'tasks/import',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static prepareTasks = createActionGroup({
    source: 'tasks/prepare',
    events: {
      do: props<{
        annotationTasks: IDBTaskItem[];
        summarizationTasks: IDBTaskItem[];
      }>(),
      success: emptyProps(),
    },
  });

  static removeTaskOrFolder = createActionGroup({
    source: 'tasks/remove task or folder',
    events: {
      do: props<{
        item: StoreItem;
      }>(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static selectItems = createActionGroup({
    source: 'modes/current mode/select items',
    events: {
      do: props<{
        ids: number[];
        deselectOthers?: boolean;
      }>(),
    },
  });

  static deselectItems = createActionGroup({
    source: 'modes/current mode/deselect items',
    events: {
      do: props<{
        ids: number[];
        deselectOthers?: boolean;
      }>(),
    },
  });

  static setSelectedItems = createActionGroup({
    source: 'modes/current mode/set selected items',
    events: {
      do: props<{
        ids: number[];
      }>(),
    },
  });

  static importItemsFromProcessingQueue = createActionGroup({
    source: 'tasks/import items from queue',
    events: {
      do: props<{
        id: number;
        mode: TPortalModes;
        results: (StoreFile | StoreAudioFile | StoreFileDirectory)[];
      }>(),
      success: props<{
        mode: TPortalModes;
        id: number;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static toggleTaskDirectoryOpened = createActionGroup({
    source: 'tasks/toggle opened directory',
    events: {
      do: props<{
        dirID: number;
      }>(),
    },
  });

  static setItemMouseOver = createActionGroup({
    source: 'tasks/set mouseover',
    events: {
      do: props<{
        id: number;
        mouseOver: boolean;
      }>(),
    },
  });

  static removeStoreItems = createActionGroup({
    source: 'tasks/remove store items',
    events: {
      do: props<{
        ids: number[];
      }>(),
    },
  });

  static changeProcessingOptionsForEachQueuedTask = createActionGroup({
      source: 'tasks/change options for each task',
      events: {
        do: props<{
          options: StoreItemTaskOptions;
        }>()
      }
  });

}
