import { createActionGroup, emptyProps, props } from '@ngrx/store';

export class TaskActions {
  static importTasks = createActionGroup({
      source: 'tasks/import',
      events: {
        do: emptyProps(),
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });
}
