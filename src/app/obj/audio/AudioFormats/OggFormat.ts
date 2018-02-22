import {AudioFormat} from './AudioFormat';

// specification found on https://wiki.xiph.org/OggVorbis
export class OggFormat extends AudioFormat {
  constructor(buffer: ArrayBuffer) {
    super(buffer);
    this._extension = '.ogg';
  }

  protected setChannels(buffer: ArrayBuffer) {
    const bufferPart = buffer.slice(38, 40);
    const bufferView = new Uint8Array(bufferPart);
    this._channels = bufferView[1];
  }

  protected setSampleRate(buffer: ArrayBuffer) {
    const bufferPart = buffer.slice(40, 42);
    const bufferView = new Uint16Array(bufferPart);
    this._sampleRate = bufferView[0];
  }

  protected setByteRate(buffer: ArrayBuffer) {
    const bufferPart = buffer.slice(48, 52);
    const bufferView = new Uint32Array(bufferPart);

    this._byteRate = bufferView[0];
  }

  protected setBitsPerSample(buffer: ArrayBuffer) {
    const bufferPart = buffer.slice(48, 52);
    const bufferView = new Uint32Array(bufferPart);

    this._byteRate = bufferView[0];
  }

  public isValid(buffer: ArrayBuffer): boolean {
    const bufferPart = buffer.slice(29, 37);
    let test = String.fromCharCode.apply(null, new Uint8Array(bufferPart));
    test = test.slice(0, 6);
    return ('' + test + '' === 'vorbis');
  }
}
