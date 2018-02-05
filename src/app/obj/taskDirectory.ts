import {DirectoryInfo} from './directoryInfo';
import {Task} from './tasks';
import {isNullOrUndefined} from 'util';
import {FileInfo} from './fileInfo';

export class TaskDirectory {
  get size(): number {
    return this._size;
  }

  get path(): string {
    return this._path;
  }

  private entries: (Task | TaskDirectory)[] = [];
  private _size: number;
  private _path: string;
  private _id: number;
  private static counter = 0;

  public constructor(path: string, size?: number) {
    this._size = size;
    this._path = DirectoryInfo.extractFolderName(path);
    this._id = ++TaskDirectory.counter;
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
          console.log(file);
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
            resolve([dir]);
          });
        });
      }
    });
  }

  public addEntries(entries: (Task | TaskDirectory)[]) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      this.entries.push(entry);
    }
  }

  public getAllTasks(): Task[] {
    let result: Task[] = [];

    for (let i = 0; i < this.entries.length; i++) {
      const elem = this.entries[i];

      if (elem instanceof Task) {
        result.push(elem);
      } else {
        result.concat((<TaskDirectory> elem).getAllTasks());
      }
    }

    return result;
  }
}
