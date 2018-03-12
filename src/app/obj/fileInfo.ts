import {DataInfo} from './dataInfo';
import {isNullOrUndefined} from 'util';

export class FileInfo extends DataInfo {
  get online(): boolean {
    return this._online;
  }

  set online(value: boolean) {
    this._online = value;
  }
  set file(value: File) {
    this._file = value;
  }

  get url(): string {
    return this._url;
  }

  set url(value: string) {
    this._url = value;
  }

  get file(): File {
    return this._file;
  }

  get extension(): string {
    return this._extension;
  }

  protected _extension: string;
  protected _file: File;
  protected _url: string;
  private _online = true;

  public get fullname(): string {
    return `${this._name}.${this._extension}`;
  }

  public set fullname(value: string) {
    const point = value.lastIndexOf('.');
    const str1 = value.substr(0, point);
    const str2 = value.substr(point + 1);
    this._name = str1;
    this._extension = str2;
  }

  public constructor(fullname: string, type: string, size: number, file?: File) {
    super(FileInfo.extractFileName(fullname).name, type, size);
    const extraction = FileInfo.extractFileName(fullname);
    if (!isNullOrUndefined(extraction)) {
      this._extension = extraction.extension;
      this._file = file;
    } else {
      throw Error('could not extract file name.')
    }
  }

  public static fromFileObject(file: File) {
    return new FileInfo(file.name, file.type, file.size, file);
  }

  public static fromURL(url: string, name: string = null) {
    let fullname = '';
    if (name != null) {
      const extension = url.substr(url.lastIndexOf('.') + 1);
      fullname = name + '.' + extension;
    } else {
      fullname = url.substr(url.lastIndexOf('/') + 1);
    }
    const result = new FileInfo(fullname, 'audio/wav', 0);
    result.url = url;
    return result;
  }

  public static escapeFileName(name: string) {
    return name.replace(/[\s\/\?\!%\*\(\)\{}&:=\+#'<>\^;,Ââ°]/g, '_');
  }

  public static renameFile(file: File, new_name: string, attributes: any): Promise<File> {
    return new Promise<File>(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (result: any) => {
          resolve(new File([result.target.result], new_name, attributes));
        };
        reader.onerror = (error) => {
          reject(error);
        };

        reader.readAsArrayBuffer(file);
      }
    );
  }

  public static extractFileName(fullname: string): { name: string, extension: string } {
    if (!isNullOrUndefined(fullname) && fullname !== '') {
      let lastslash;
      if ((lastslash = fullname.lastIndexOf('/')) > -1) {
        // if path remove all but the filename
        fullname = fullname.substr(lastslash);
      }

      let extension_begin;
      if ((extension_begin = fullname.lastIndexOf('.')) > -1) {
        // split name and extension
        const name = fullname.substr(0, extension_begin);
        const extension = fullname.substr(extension_begin + 1);

        return {
          name: name,
          extension: extension
        }
      } else {
        throw new Error('invalid fullname. Fullname must contain the file extension');
      }
    }

    return null;
  }

  public toAny() {
    return {
      fullname: this.fullname,
      size: this.size,
      type: this.type,
      url: this.url,
      attributes: this.attributes
    };
  }
}
