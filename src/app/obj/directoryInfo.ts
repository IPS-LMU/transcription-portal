import {DataInfo} from './dataInfo';
import {FileInfo} from './fileInfo';
import {isNullOrUndefined} from 'util';

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

  private _path: string;
  private _entries: (FileInfo | DirectoryInfo)[] = [];

  public constructor(path: string, size?: number) {
    super(DirectoryInfo.extractFolderName(path), 'folder', size);
    this._path = path;
  }

  public static fromFolderObject(folder: DataTransferItem): Promise<DirectoryInfo> {
    return new Promise<DirectoryInfo>((resolve, reject) => {
      if (folder) {
        DirectoryInfo.traverseFileTree(folder, '').then((result) => {
          if (!isNullOrUndefined(result) && result[0] instanceof DirectoryInfo) {
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

  private static traverseFileTree(item: (DataTransferItem | WebKitFileEntry), path): Promise<(FileInfo | DirectoryInfo)[]> {
    //console.log(`search path: ${path}`);
    return new Promise<(FileInfo | DirectoryInfo)[]>((resolve, reject) => {
        path = path || '';
        if (!isNullOrUndefined(item)) {
          let webKitEntry: WebKitEntry;

          if (item instanceof DataTransferItem) {
            webKitEntry = item.webkitGetAsEntry();
          } else {
            webKitEntry = <WebKitEntry> item;
          }

          if (webKitEntry.isFile) {
            //console.log(`isFile ${item.fullPath}`);
            // Get file

            if (item instanceof DataTransferItem) {
              let file = item.getAsFile();

              if (!isNullOrUndefined(file)) {
                let fileInfo = new FileInfo(file.name, file.type, file.size, file);
                resolve([fileInfo]);
              } else {
                reject(`could not read file`);
              }
            } else {
              // item is FileEntry

              (<WebKitFileEntry> webKitEntry).file((file: any) => {
                let fileInfo = new FileInfo(file.name, file.type, file.size, file);
                resolve([fileInfo]);
              });
            }
          } else if (webKitEntry.isDirectory) {
            // Get folder contents
            //console.log(`is dir ${item.fullPath}`);
            let dirEntry: WebKitDirectoryEntry = <WebKitDirectoryEntry> webKitEntry;
            let dirReader = dirEntry.createReader();
            dirReader.readEntries((entries: any) => {
              let promises: Promise<(FileInfo | DirectoryInfo)[]>[] = [];
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
                    let a2 = <FileInfo> a;
                    let b2 = <FileInfo> b;

                    return a2.name.localeCompare(b2.name);
                  }
                  else if (a instanceof DirectoryInfo && b instanceof DirectoryInfo) {
                    let a2 = <DirectoryInfo> a;
                    let b2 = <DirectoryInfo> b;

                    return a2.path.localeCompare(b2.path);
                  }
                  else {
                    return 0;
                  }
                });

                //console.log(result);
                dir.addEntries(result);
                //console.log(`dir with ${result.length} found`);
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
    let result = new DirectoryInfo(this.path, this.size);
    result._entries = this.entries;

    return result;
  }
}
