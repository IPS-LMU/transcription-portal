import {TaskDirectory} from './taskDirectory';
import {isNullOrUndefined} from 'util';
import {Task, TaskState} from './task';
import {Subject} from 'rxjs/Subject';

export interface EntryChangeEvent {
  state: 'added' | 'removed' | 'changed';
  saveToDB: boolean,
  entry: (Task | TaskDirectory);
}

export class TaskList {

  public get length(): number {
    let result = 0;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      if (entry instanceof Task) {
        result++;
      } else {
        // TaskDirectory
        result += entry.entries.length + 1;
      }
    }

    return result;
  }

  get entryChanged(): Subject<EntryChangeEvent> {
    return this._entryChanged;
  }

  get entries(): (Task | TaskDirectory)[] {
    return this._entries;
  }

  private _entries: (Task | TaskDirectory)[] = [];
  private _entryChanged: Subject<EntryChangeEvent> = new Subject<EntryChangeEvent>();

  constructor() {
  }

  public addEntry(newEntry: (Task | TaskDirectory), saveToDB: boolean = false): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (isNullOrUndefined(this.findEntryById(newEntry.id))) {
        this._entries.push(newEntry);
        this._entryChanged.next({
          state: 'added',
          saveToDB: saveToDB,
          entry: newEntry
        });
        resolve();
      } else {
        reject(`entry already in list`);
      }
    });
  }

  public findTaskByState(state: TaskState): Task {
    let tasks = this.getAllTasks();

    return tasks.find((a) => {
      if (a.state === state) {
        return true;
      }
    });
  }

  public findEntryById(id: number): (Task | TaskDirectory) {
    let tasks = this.getAllTasks();

    return tasks.find((a) => {
      if (a.id === id) {
        return true;
      }
    });
  }

  public findTaskDirByPath(path: string): TaskDirectory {
    let tasks = this.getAllTaskDirectories();

    return tasks.find((a) => {
      if (a.path === path) {
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

  public getIndexByEntry(selectedEntry: Task | TaskDirectory): number {
    let result = -1;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];

      if (entry instanceof Task) {
        if (entry.id === selectedEntry.id) {
          return result + 1;
        }
      } else {
        // TaskDirectory
        if (entry.id !== selectedEntry.id) {
          for (let j = 0; j < entry.entries.length; j++) {
            const subEntry = entry.entries[j];

            if (subEntry.id === selectedEntry.id) {
              return result + j + 2;
            }
          }
          result += entry.entries.length;
        } else {
          return result + 1;
        }
      }
      result++;
    }


    return result;
  }

  public getEntryByIndex(index: number) {
    let counter = -1;

    for (let i = 0; i < this.entries.length; i++) {
      counter++;
      const entry = this.entries[i];

      if (entry instanceof Task) {
        if (counter === index) {
          return entry;
        }
      } else {
        // TaskDirectory
        if (index !== counter) {
          for (let j = 0; j < entry.entries.length; j++) {
            const subEntry = entry.entries[j];

            if (counter + j + 1 === index) {
              return subEntry;
            }
          }
          counter += entry.entries.length;
        } else {
          return entry;
        }
      }
    }

    return null;
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

  public removeEntry(entry: (Task | TaskDirectory), saveToDB: boolean = false): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sendEvent = () => {
        this._entryChanged.next({
          state: 'removed',
          saveToDB: saveToDB,
          entry: entry
        })
      };
      if (!isNullOrUndefined(entry)) {
        if (entry instanceof Task) {
          if (!isNullOrUndefined(entry.directory)) {
            entry.directory.removeTask(entry);
            this.cleanup(entry.directory, saveToDB).then(() => {
              resolve();
            }).catch((error) => {
              reject(error);
            });
          } else {
            const task_index = this.entries.findIndex((a) => {
              if (a instanceof Task && (<Task> a).id === entry.id) {
                return true;
              }
            });

            if (task_index > -1) {
              this._entries.splice(task_index, 1);
            } else {
              console.log(`entry not found with ID ${entry.id}`);
            }

            resolve();
            sendEvent();
          }
        } else {
          const task_index = this.entries.findIndex((a) => {
            if (a instanceof TaskDirectory && (<TaskDirectory> a).id === entry.id) {
              return true;
            }
          });

          if (task_index > -1) {
            this._entries.splice(task_index, 1);
          } else {
            console.log(`entry not found with ID ${entry.id}`);
          }

          resolve();
          sendEvent();
        }
      }
    });
  }

  public cleanup(entry: (Task | TaskDirectory), saveToDB: boolean): Promise<void> {
    if (!isNullOrUndefined(entry)) {
      if (entry instanceof Task) {

      } else {
        if (entry.entries.length === 0) {
          // remove dir
          return this.removeEntry(entry, saveToDB);
        } else if (entry.entries.length === 1) {
          // move entry task to upper level and remove dir
          const entryTask = <Task> entry.entries[0];
          entryTask.directory = null;
          return this.removeEntry(entryTask, saveToDB).then(() => {
            return this.removeEntry(entry, saveToDB)
          }).then(() => {
            console.log(`CLEANUP ADD ENTRY`);
            return this.addEntry(entryTask, saveToDB)
          });
        }
      }
    }
  }
}