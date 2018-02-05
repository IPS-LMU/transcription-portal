import {TaskDirectory} from './taskDirectory';
import {Task, TaskState} from './tasks';
import {isNullOrUndefined} from 'util';

export class TaskList {
  get entries(): (Task | TaskDirectory)[] {
    return this._entries;
  }

  private _entries: (Task | TaskDirectory)[] = [];

  constructor() {
  }

  public addEntry(newEntry: (Task | TaskDirectory)) {
    this._entries.push(newEntry);
  }

  public findTaskByState(state: TaskState): Task {
    let tasks = this.getAllTasks();
    console.log(tasks);

    return tasks.find((a) => {
      if (a.state === state) {
        return true;
      }
    });
  }

  public findTaskById(id: number): Task {
    let tasks = this.getAllTasks();
    console.log(tasks);

    return tasks.find((a) => {
      if (a.id === id) {
        return true;
      }
    });
  }

  public getAllTasks(): Task[] {
    let result: Task[] = [];

    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];
      if (entry instanceof Task) {
        result.push(entry);
      } else {
        result = result.concat((<TaskDirectory> entry).getAllTasks());
      }
    }

    return result;
  }

  public removeTask(task: Task) {
    if (!isNullOrUndefined(task.directory)) {
      task.directory.removeTask(task);
    } else {
      const task_index = this.entries.findIndex((a) => {
        if (a instanceof Task && (<Task> a).id === task.id) {
          return true;
        }
      });

      console.log('remove ' + task_index);
      this._entries.splice(task_index, 1);
    }
  }

  public removeDir(dir: TaskDirectory) {
    if (!isNullOrUndefined(dir)) {
      const task_index = this.entries.findIndex((a) => {
        if (a instanceof TaskDirectory && (<TaskDirectory> a).id === dir.id) {
          return true;
        }
      });

      console.log('remove dir ' + task_index);
      this._entries.splice(task_index, 1);
    }
  }
}