export class FileInfo {
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

  public constructor(fullname: string, type: string, size: number, file?: File) {
    this.extractFileName(fullname);
    this._type = type;
    this._size = size;
    this._file = file;
  }

  public static fromFileObject(file: File) {
    return new FileInfo(file.name, file.type, file.size, file);
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
