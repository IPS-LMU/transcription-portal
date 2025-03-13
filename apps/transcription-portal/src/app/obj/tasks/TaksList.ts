import { Subject } from 'rxjs';
import { Task, TaskDirectory, TaskState } from './task';

export interface EntryChangeEvent {
  state: 'added' | 'removed' | 'changed';
  saveToDB: boolean;
  entry: Task | TaskDirectory;
}

export class TaskList {
  public get length(): number {
    let result = 0;

    for (const entry of this.entries) {
      if (entry instanceof Task) {
        result++;
      } else {
        // TaskDirectory
        result += entry.entries.length + 1;
      }
    }

    return result;
  }

  private _entries: (Task | TaskDirectory)[] = [];

  get entries(): (Task | TaskDirectory)[] {
    return this._entries;
  }

  private _entryChanged: Subject<EntryChangeEvent> =
    new Subject<EntryChangeEvent>();

  get entryChanged(): Subject<EntryChangeEvent> {
    return this._entryChanged;
  }

  public addEntry(
    newEntry: Task | TaskDirectory,
    saveToDB: boolean = false,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (
        this.findEntryById(newEntry.id) === null ||
        this.findEntryById(newEntry.id) === undefined
      ) {
        this._entries.push(newEntry);
        this._entryChanged.next({
          state: 'added',
          saveToDB,
          entry: newEntry,
        });
        resolve();
      } else {
        reject(`entry already in list`);
      }
    });
  }

  public changeEntry(
    id: number,
    newEntry: Task | TaskDirectory,
    saveToDB: boolean = false,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const foundEntry = this._entries.findIndex((a) => a.id === id);

      if (foundEntry > -1) {
        this._entries[foundEntry] = newEntry;
        this._entryChanged.next({
          state: 'changed',
          saveToDB,
          entry: newEntry,
        });
        resolve();
      } else {
        reject(`entry not found`);
      }
    });
  }

  public findTaskByState(state: TaskState): Task | undefined {
    const tasks = this.getAllTasks();

    return tasks.find((a: Task) => {
      return a.state === state;
    });
  }

  public findEntryById(id: number): (Task | TaskDirectory) | undefined {
    const tasks = this.getAllTasks();

    return tasks.find((a) => {
      return a.id === id;
    });
  }

  public findTaskDirByPath(path: string): TaskDirectory | undefined {
    const tasks = this.getAllTaskDirectories();

    return tasks.find((a) => {
      return a.path === path;
    });
  }

  public getAllTasks(): Task[] {
    let result: Task[] = [];

    for (const entry of this._entries) {
      if (entry instanceof Task) {
        result.push(entry);
      } else if (entry instanceof TaskDirectory) {
        result = result.concat((entry as TaskDirectory).getAllTasks());
      }
    }

    return result;
  }

  public getIndexByEntry(selectedEntry: Task | TaskDirectory): number {
    let result = -1;

    for (const entry of this.entries) {
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

    for (const entry of this.entries) {
      counter++;
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
    const result: TaskDirectory[] = [];

    for (const entry of this._entries) {
      if (entry instanceof TaskDirectory) {
        result.push(entry);
      }
    }

    return result;
  }

  public removeEntry(
    entry: Task | TaskDirectory,
    saveToDB: boolean = false,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const sendEvent = () => {
        this._entryChanged.next({
          state: 'removed',
          saveToDB,
          entry,
        });
      };
      if (!(entry === null || entry === undefined)) {
        if (entry instanceof Task) {
          if (!(entry.directory === null || entry.directory === undefined)) {
            entry.directory.removeTask(entry);
            this.cleanup(entry.directory, saveToDB)
              .then(() => {
                resolve();
              })
              .catch((error) => {
                reject(error);
              });
          } else {
            const taskIndex = this.entries.findIndex((a) => {
              return a instanceof Task && (a as Task).id === entry.id;
            });

            if (taskIndex > -1) {
              this._entries.splice(taskIndex, 1);
            } else {
              console.log(`entry not found with ID ${entry.id}`);
            }

            resolve();
            sendEvent();
          }
        } else {
          const taskIndex = this.entries.findIndex((a) => {
            return (
              a instanceof TaskDirectory && (a as TaskDirectory).id === entry.id
            );
          });

          if (taskIndex > -1) {
            this._entries.splice(taskIndex, 1);
          } else {
            console.log(`entry not found with ID ${entry.id}`);
          }

          resolve();
          sendEvent();
        }
      }
    });
  }

  public cleanup(
    entry: Task | TaskDirectory,
    saveToDB: boolean,
  ): Promise<void> {
    if (
      !(entry === null || entry === undefined) &&
      entry instanceof TaskDirectory
    ) {
      if (entry.entries.length === 0) {
        // remove dir
        return this.removeEntry(entry, saveToDB);
      } else if (entry.entries.length === 1) {
        // move entry task to upper level and remove dir
        const entryTask = entry.entries[0] as Task;
        entryTask.directory = undefined;
        return this.removeEntry(entryTask, saveToDB)
          .then(() => {
            return this.removeEntry(entry, saveToDB);
          })
          .then(() => {
            return this.addEntry(entryTask, saveToDB);
          });
      } else {
        return new Promise<void>((resolve) => {
          resolve();
        });
      }
    } else {
      return new Promise<void>((resolve) => {
        resolve();
      });
    }
  }
}
