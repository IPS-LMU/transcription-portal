import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBTaskItem } from '../../indexedDB';
import { StoreTask } from './task';
import { StoreTaskDirectory } from '../task-directory';

export class TaskActions {
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
          item: StoreTask | StoreTaskDirectory
        }>(),
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

}
