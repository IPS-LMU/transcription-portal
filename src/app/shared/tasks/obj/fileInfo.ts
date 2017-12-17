export class FileInfo {
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

  get size(): number {
    return this._size;
  }

  get name(): string {
    return this._name;
  }

  get type(): string {
    return this._type;
  }

  get extension(): string {
    return this._extension;
  }

  private _type: string;
  private _extension: string;
  private _name: string;
  private _size: number;
  private _file: File;
  private _url: string;

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
    this.extractFileName(fullname);
    this._type = type;
    this._size = size;
    this._file = file;
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
    const result = new FileInfo(fullname, 'audio-wav', 0);
    result.url = url;
    return result;
  }

  public static escapeFileName(name: string) {
    return name.replace(/[\s\\/\?\!%\*(){}&:=+#'<>^;,Ââ°]/g, '_');
  }

  public static renameFile(file: File, new_name: string, attributes: any): Promise<File> {
    return new Promise<File>(
      (resolve, reject) => {
        const reader = new FileReader();

        reader.onload = (result: any) => {
          console.log('RESULT');
          console.log(result);
          resolve(new File([ result.target.result ], new_name, attributes));
        };
        reader.onerror = (error) => {
          reject(error);
        };

        reader.readAsArrayBuffer(file);
      }
    );
  }

  private extractFileName(fullname: string) {
    if (fullname !== '') {
      let lastslash;
      if ((lastslash = fullname.lastIndexOf('/')) > -1) {
        // if path remove all but the filename
        fullname = fullname.substr(lastslash);
      }

      let extension_begin;
      if ((extension_begin = fullname.indexOf('.')) > -1) {
        // split name and extension
        this._name = fullname.substr(0, extension_begin);
        this._extension = fullname.substr(extension_begin + 1);
        console.log(this.extension);
      } else {
        throw new Error('invalid fullname. Fullname must contain the file extension');
      }
    }
  }
}
