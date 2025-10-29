import { AudioFileInfoSerialized, AudioInfo, DirectoryInfo, FileInfo } from '@octra/web-media';

export interface TPortalFileInfoAttributes {
  originalFileName: string;
}

export class TPortalFileInfo extends FileInfo<TPortalFileInfoAttributes> {
  protected override _attributes!: TPortalFileInfoAttributes;

  override get attributes(): TPortalFileInfoAttributes {
    return this._attributes;
  }

  override set attributes(attributes: TPortalFileInfoAttributes) {
    this._attributes = attributes;
  }

  override clone(): TPortalFileInfo {
    const result = new TPortalFileInfo(this.fullname, this._type, this._size, this._file, this._createdAt);

    result._attributes = { ...this._attributes } as TPortalFileInfoAttributes;
    result._hash = this._hash;
    result._online = this._online;
    result._url = this._url;
    return result;
  }
}

export class TPortalDirectoryInfo extends DirectoryInfo<TPortalFileInfo | TPortalAudioInfo, TPortalFileInfoAttributes, TPortalFileInfoAttributes> {
  protected override _attributes!: TPortalFileInfoAttributes;

  override get attributes(): TPortalFileInfoAttributes {
    return this._attributes;
  }

  override set attributes(attributes: TPortalFileInfoAttributes) {
    this._attributes = attributes;
  }

  override clone(): TPortalDirectoryInfo {
    const result = new TPortalDirectoryInfo(this._path, this._size);
    result._entries = this._entries.map((a) => a.clone() as TPortalFileInfo | TPortalAudioInfo | TPortalDirectoryInfo);
    result._hash = this._hash;
    result._attributes = { ...this._attributes } as TPortalFileInfoAttributes;
    result._type = this._type;

    return result;
  }
}

export class TPortalAudioInfo extends AudioInfo<TPortalFileInfoAttributes> {
  protected override _attributes!: TPortalFileInfoAttributes;

  override get attributes(): TPortalFileInfoAttributes {
    return this._attributes;
  }

  override set attributes(attributes: TPortalFileInfoAttributes) {
    this._attributes = attributes;
  }

  override clone(): TPortalAudioInfo {
    const result = new TPortalAudioInfo(
      this.fullname,
      this._type,
      this._size,
      this.sampleRate,
      this.duration.samples,
      this.channels,
      this.bitrate,
      this._audioBufferInfo,
    );
    result._file = this._file;
    result._attributes = { ...this._attributes } as TPortalFileInfoAttributes;
    result._hash = this._hash;
    result._url = this._url;
    result._online = this._online;

    return result;
  }

  override toAny(): Promise<AudioFileInfoSerialized> {
    return super.toAny();
  }

  static override fromAny<F extends object>(object: AudioFileInfoSerialized): AudioInfo<F> {
    return super.fromAny<F>(object);
  }
}
