import {Task} from './task';
import {isNullOrUndefined} from 'util';
import {FileInfo} from '../fileInfo';
import {DirectoryInfo} from '../directoryInfo';

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
  public static counter = 0;

  public constructor(path: string, size?: number) {
    this._size = size;
    this._path = path;
    this._id = ++TaskDirectory.counter;
    this._foldername = DirectoryInfo.extractFolderName(path);
  }

  public static fromFolderObject(folder: WebKitDirectoryEntry): Promise<TaskDirectory> {
    return new Promise<TaskDirectory>((resolve, reject) => {
      if (folder) {
        TaskDirectory.traverseFileTree(folder, '').then((result) => {
          if (!isNullOrUndefined(result) && result[0] instanceof TaskDirectory) {
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
            //console.log(`dir with ${result.length} found`);
            console.log(`RESULT`);
            console.log(dir);
            resolve([dir]);
          });
        });
      }
    });
  }

  public addEntries(entries: (Task | TaskDirectory)[]) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

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

  public toAny(): any {
    return {
      id: this.id,
      type: 'folder',
      folderPath: this.path,
      entries: []
    };
  }
}
