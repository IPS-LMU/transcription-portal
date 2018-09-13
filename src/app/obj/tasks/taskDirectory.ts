import {Task} from './task';
import {FileInfo} from '../fileInfo';
import {DirectoryInfo} from '../directoryInfo';
import {TaskEntry} from './task-entry';
import {Operation} from '../operations/operation';

export class TaskDirectory {
  get foldername(): string {
    return this._foldername;
  }

  get type(): string {
    return this._type;
  }

  get id(): number {
    return this._id;
  }

  get entries(): (Task | TaskDirectory)[] {
    return this._entries;
  }

  get size(): number {
    return this._size;
  }

  get path(): string {
    return this._path;
  }

  private _entries: (Task | TaskDirectory)[] = [];
  private _size: number;
  private _path: string;
  private _id: number;
  private _foldername: string;
  private _type = 'folder';

  public constructor(path: string, size?: number, id?: number) {
    this._size = size;
    this._path = path;
    if (!(id === null || id === undefined)) {
      this._id = id;
    } else {
      this._id = ++TaskEntry.counter;
    }
    this._foldername = DirectoryInfo.extractFolderName(path);
  }

  public static fromFolderObject(folder: WebKitDirectoryEntry): Promise<TaskDirectory> {
    return new Promise<TaskDirectory>((resolve, reject) => {
      if (folder) {
        TaskDirectory.traverseFileTree(folder, '').then((result) => {
          if (!(result === null || result === undefined) && result[0] instanceof TaskDirectory) {
            resolve(<TaskDirectory> result[0]);
          } else {
            reject('could not parse directory');
          }
        }).catch(error => {
          reject(error);
        });
      } else {
        reject('folder not given.');
      }
    });
  }

  private static traverseFileTree(item, path): Promise<(Task | TaskDirectory)[]> {
    //console.log(`search path: ${path}`);
    return new Promise<(Task | TaskDirectory)[]>((resolve, reject) => {
      path = path || '';
      if (item.isFile) {
        //console.log(`isFile ${item.fullPath}`);
        // Get file
        item.file((file) => {
          let fileInfo = new FileInfo(file.fullName, file.type, 0, file);
          const task = new Task([fileInfo], []);
          //console.log("get file");
          resolve([task]);
        });
      } else if (item.isDirectory) {
        // Get folder contents
        //console.log(`is dir ${item.fullPath}`);

        let dirReader = item.createReader();
        dirReader.readEntries((entries) => {
          let promises: Promise<(Task | TaskDirectory)[]>[] = [];
          for (let i = 0; i < entries.length; i++) {
            promises.push(this.traverseFileTree(entries[i], path + item.name + '/'));
          }
          Promise.all(promises).then((values: (Task | TaskDirectory)[][]) => {
            const dir = new TaskDirectory(path + item.name + '/');
            let result = [];

            for (let i = 0; i < values.length; i++) {
              const value = values[i];

              for (let j = 0; j < value.length; j++) {
                const val = value[j];

                result.push(val);
              }
            }

            //console.log(result);
            dir.addEntries(result);
            resolve([dir]);
          });
        });
      }
    });
  }

  public addEntries(entries: (Task | TaskDirectory)[]) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (entry instanceof Task) {
        entry.directory = this;
      }
      this._entries.push(entry);
    }
  }

  public getAllTasks(): Task[] {
    let result: Task[] = [];

    for (let i = 0; i < this._entries.length; i++) {
      const elem = this._entries[i];

      if (elem instanceof Task) {
        result.push(elem);
      } else {
        result = result.concat((<TaskDirectory> elem).getAllTasks());
      }
    }

    return result;
  }

  public removeTask(task: Task) {
    const task_index = this.entries.findIndex((a) => {
      if (a instanceof Task && (<Task> a).id === task.id) {
        return true;
      }
    });
    this._entries.splice(task_index, 1);
  }

  public toAny(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const result = {
        id: this.id,
        type: 'folder',
        path: this.path,
        entries: []
      };

      const promises: Promise<any>[] = [];
      for (let i = 0; i < this.entries.length; i++) {
        const entry = this.entries[i];
        promises.push(entry.toAny());
      }

      Promise.all(promises).then((values) => {
        result.entries = values;
        resolve(result);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  public static fromAny(dirObj: any, defaultOperations: Operation[]): TaskDirectory {
    const result = new TaskDirectory(dirObj.path, undefined, dirObj.id);

    for (let i = 0; i < dirObj.entries.length; i++) {
      const entry = dirObj.entries[i];
      result.addEntries([Task.fromAny(entry, defaultOperations)]);
    }

    return result;
  }
}
