import {DataInfo} from './dataInfo';
import {TaskDirectory} from './taskDirectory';

export class DirectoryInfo extends DataInfo {
  get path(): string {
    return this._path;
  }

  private _path: string;

  public constructor(path: string, size?: number) {
    const name = DirectoryInfo.extractFolderName(path);
    super(name, 'folder', size);
    this._path = path;
  }

  public static fromFolderObject(folder: WebKitDirectoryEntry): Promise<TaskDirectory> {
    return new Promise<TaskDirectory>((resolve, reject) => {
      resolve(null);
    });
  };

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
}
