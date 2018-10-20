import {DataInfo} from './dataInfo';
import {FileInfo} from './fileInfo';

export class DirectoryInfo extends DataInfo {
  set entries(value: (FileInfo | DirectoryInfo)[]) {
    this._entries = value;
  }

  get entries(): (FileInfo | DirectoryInfo)[] {
    return this._entries;
  }

  get path(): string {
    return this._path;
  }

  private readonly _path: string;
  private _entries: (FileInfo | DirectoryInfo)[] = [];

  public constructor(path: string, size?: number) {
    super(DirectoryInfo.extractFolderName(path), 'folder', size);
    this._path = path;
  }

  public static fromFolderObject(folder: DataTransferItem): Promise<DirectoryInfo> {
    return new Promise<DirectoryInfo>((resolve, reject) => {
      if (folder) {
        DirectoryInfo.traverseFileTree(folder, '').then((result) => {
          if (!(result === null || result === undefined) && result[0] instanceof DirectoryInfo) {
            resolve(<DirectoryInfo> result[0]);
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

  private static traverseFileTree(item: (DataTransferItem | any), path): Promise<(FileInfo | DirectoryInfo)[]> {
    // console.log(`search path: ${path}`);
    return new Promise<(FileInfo | DirectoryInfo)[]>((resolve, reject) => {
        path = path || '';
      if (!(item === null || item === undefined)) {
        let webKitEntry: any;

          if (item instanceof DataTransferItem) {
            webKitEntry = item.webkitGetAsEntry();
          } else {
            webKitEntry = <any> item;
          }

          if (webKitEntry.isFile) {
            // console.log(`isFile ${item.fullPath}`);
            // Get file

            if (item instanceof DataTransferItem) {
              const file = item.getAsFile();

              if (!(file === null || file === undefined)) {
                if (file.name.indexOf('.') > -1) {
                  const fileInfo = new FileInfo(file.name, file.type, file.size, file);
                  resolve([fileInfo]);
                } else {
                  resolve([]);
                }
              } else {
                reject(`could not read file`);
              }
            } else {
              // item is FileEntry

              (<any> webKitEntry).file((file: any) => {
                if (file.name.indexOf('.') > -1) {
                  const fileInfo = new FileInfo(file.name, file.type, file.size, file);
                  resolve([fileInfo]);
                } else {
                  resolve([]);
                }
              });
            }
          } else if (webKitEntry.isDirectory) {
            // Get folder contents
            // console.log(`is dir ${item.fullPath}`);
            const dirEntry: any = <any> webKitEntry;
            const dirReader = dirEntry.createReader();
            dirReader.readEntries((entries: any) => {
              const promises: Promise<(FileInfo | DirectoryInfo)[]>[] = [];
              for (let i = 0; i < entries.length; i++) {
                promises.push(this.traverseFileTree(entries[i], path + dirEntry.name + '/'));
              }
              Promise.all(promises).then((values: (FileInfo | DirectoryInfo)[][]) => {
                const dir = new DirectoryInfo(path + dirEntry.name + '/');
                let result: (FileInfo | DirectoryInfo)[] = [];

                for (let i = 0; i < values.length; i++) {
                  const value = values[i];

                  for (let j = 0; j < value.length; j++) {
                    const val = value[j];

                    result.push(val);
                  }
                }

                result = result.sort((a, b) => {
                  if (a instanceof FileInfo && b instanceof FileInfo) {
                    const a2 = <FileInfo> a;
                    const b2 = <FileInfo> b;

                    return a2.name.localeCompare(b2.name);
                  } else if (a instanceof DirectoryInfo && b instanceof DirectoryInfo) {
                    const a2 = <DirectoryInfo> a;
                    const b2 = <DirectoryInfo> b;

                    return a2.path.localeCompare(b2.path);
                  } else {
                    return 0;
                  }
                });

                // console.log(result);
                dir.addEntries(result);
                // console.log(`dir with ${result.length} found`);
                resolve([dir]);
              });
            });
          }
        } else {
          reject(`item is null or undefined`);
        }
      }
    );
  }

  public static extractFolderName(path: string): string {
    if (path !== '') {
      let extension_begin;
      if ((extension_begin = path.lastIndexOf('/')) > -1) {
        // split name and extension
        let foldername = path.substr(0, extension_begin);

        if ((extension_begin = foldername.lastIndexOf('/')) > -1) {
          foldername = foldername.substr(extension_begin + 1);
        }

        return foldername;
      } else {
        throw new Error('invalid folder path.');
      }
    }
    return null;
  }

  public addEntries(entries: (FileInfo | DirectoryInfo)[]) {
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      this._entries.push(entry);
    }
  }

  public clone() {
    const result = new DirectoryInfo(this.path, this.size);
    result._entries = this.entries;

    return result;
  }
}
