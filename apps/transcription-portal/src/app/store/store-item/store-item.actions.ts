import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBTaskItem } from '../../indexedDB';
import { StoreItem } from './store-item';

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
      }>(),
    },
  });

  static deselectItems = createActionGroup({
    source: 'modes/current mode/deselect items',
    events: {
      do: props<{
        ids: number[];
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
}
