import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBTaskItem } from '../../indexedDB';

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
}
