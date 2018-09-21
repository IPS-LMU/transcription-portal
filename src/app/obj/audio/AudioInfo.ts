import {AudioTime} from './AudioTime';
import {FileInfo} from '../fileInfo';

export class AudioInfo extends FileInfo {
  get bitrate(): number {
    return this._bitrate;
  }

  get channels(): number {
    return this._channels;
  }

  set duration(value: AudioTime) {
    this._duration = value;
  }

  get samplerate(): number {
    return this._samplerate;
  }

  get duration(): AudioTime {
    return this._duration;
  }

  private readonly _samplerate: number;
  private readonly _bitrate: number = -1;
  private readonly _channels: number = -1;
  private _duration: AudioTime;

  constructor(fullname: string, type: string, size: number, samplerate: number,
              duration: number, channels: number, bitrate: number, file?: File) {
    super(fullname, type, size, file);
    this._samplerate = samplerate;
    this._duration = new AudioTime(duration, samplerate);
    this._channels = channels;
    this._bitrate = bitrate;
  }
}

