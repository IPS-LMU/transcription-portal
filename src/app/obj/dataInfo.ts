export class DataInfo {
  set size(value: number) {
    this._size = value;
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

  protected _type: string;
  protected _name: string;
  private _size: number;

  public constructor(name: string, type: string, size?: any) {
    this._name = name;
    this._type = type;
    this._size = (size != undefined) ? size : 0;
  }
}
