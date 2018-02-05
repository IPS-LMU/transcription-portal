import {TaskDirectory} from './taskDirectory';
import {Task, TaskState} from './tasks';

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
}