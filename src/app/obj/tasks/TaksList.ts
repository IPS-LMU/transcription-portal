import {TaskDirectory} from './taskDirectory';
import {isNullOrUndefined} from 'util';
import {Task, TaskState} from './task';

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

    return tasks.find((a) => {
      if (a.state === state) {
        return true;
      }
    });
  }

  public findTaskById(id: number): Task {
    let tasks = this.getAllTasks();

    return tasks.find((a) => {
      if (a.id === id) {
        return true;
      }
    });
  }

  public findTaskDirByPath(path: string): TaskDirectory {
    let tasks = this.getAllTaskDirectories();

    console.log(tasks);
    return tasks.find((a) => {
      if (a.path === path) {
        return true;
      } else {
        console.log(`${a.path} is not ${path}`);
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

  public getAllTaskDirectories(): TaskDirectory[] {
    let result: TaskDirectory[] = [];

    for (let i = 0; i < this._entries.length; i++) {
      const entry = this._entries[i];
      if (entry instanceof TaskDirectory) {
        result.push(entry);
      }
    }

    return result;
  }

  public removeEntry(entry: (Task | TaskDirectory)) {
    if (entry instanceof Task) {
      if (!isNullOrUndefined(entry.directory)) {
        entry.directory.removeTask(entry);
      } else {
        const task_index = this.entries.findIndex((a) => {
          if (a instanceof Task && (<Task> a).id === entry.id) {
            return true;
          }
        });

        this._entries.splice(task_index, 1);
      }
    }
  }

  public removeDir(dir: TaskDirectory) {
    if (!isNullOrUndefined(dir)) {
      const task_index = this.entries.findIndex((a) => {
        if (a instanceof TaskDirectory && (<TaskDirectory> a).id === dir.id) {
          return true;
        }
      });

      this._entries.splice(task_index, 1);
    }
  }
}