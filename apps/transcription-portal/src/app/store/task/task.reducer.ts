import { EntityAdapter } from '@ngrx/entity';
import { ActionCreator, on, ReducerTypes } from '@ngrx/store';
import { Mode, ModeState } from '../mode';
import { StoreTaskDirectory } from '../task-directory';
import { StoreTask } from './task';
import { TaskActions } from './task.actions';
import { convertIDBTaskToStoreTask } from './task.functions';

export const getTaskReducers = (
  modeAdapter: EntityAdapter<Mode<any>>,
  taskAdapter: EntityAdapter<StoreTask | StoreTaskDirectory>,
): ReducerTypes<ModeState, readonly ActionCreator[]>[] => [
  on(TaskActions.prepareTasks.do, (state: ModeState, { annotationTasks, summarizationTasks }) => {
    const tasks: {
      annotation: (StoreTask | StoreTaskDirectory)[];
      summarization: (StoreTask | StoreTaskDirectory)[];
    } = {
      annotation: annotationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter)),
      summarization: summarizationTasks.map((a) => convertIDBTaskToStoreTask(a, taskAdapter)),
    };

    for (const id of Object.keys(tasks)) {
      state = modeAdapter.updateOne(
        {
          id,
          changes: {
            tasks: taskAdapter.addMany((tasks as never)[id], state.entities[id]!.tasks),
          },
        },
        state,
      );
    }

    return state;
  }),
];
