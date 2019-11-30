import {SourceType} from './index';

export class MediaRessource {
  private readonly _name: string;
  private readonly _extension: string;
  private readonly _size: number;
  private source: SourceType;

  constructor(fullname: string, source: SourceType, buffer?: ArrayBuffer, size?: number) {
    if (source !== SourceType.URL && (buffer === null || buffer === undefined)) {
      throw new Error('MediaRessource of type File or ArrayBuffer must have content');
    } else if (fullname.lastIndexOf('.') === -1) {
      throw new Error('fullname parameter needs to consist of an file extension');
    } else {
      const extensionstart = fullname.lastIndexOf('.');
      this._name = fullname.substr(0, extensionstart);
      this._extension = fullname.substr(extensionstart);
      this._size = size;
      this.source = source;
      this._arraybuffer = buffer;
    }
  }

  get size(): number {
    return this._size;
  }

  get extension(): string {
    return this._extension;
  }

  get name(): string {
    return this._name;
  }

  private _arraybuffer: ArrayBuffer;

  get arraybuffer(): ArrayBuffer {
    return this._arraybuffer;
  }

  set arraybuffer(value: ArrayBuffer) {
    this._arraybuffer = value;
  }
}
