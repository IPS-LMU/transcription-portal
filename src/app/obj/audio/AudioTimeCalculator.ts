import {AudioTime} from './AudioTime';
import {AudioChunk} from './AudioManager';

export class AudioTimeCalculator {
  constructor(public samplerate: number,
              public _duration: AudioTime,
              public audioPxWidth: number) {
    if (this.audioPxWidth === null || this.audioPxWidth < 1) {
      console.error('audio px null');
    }
  }

  set duration(value: AudioTime) {
    this._duration = value;
  }

  public static roundSamples(samples: number) {
    return Math.round(samples);
  }

  public samplestoAbsX(timeSamples: number, duration?: AudioTime): number {
    const dur = (duration) ? duration : this._duration;

    if (dur.samples === 0) {
      throw new Error('time duration must have samples greater 0');
    }

    return (timeSamples / dur.samples) * this.audioPxWidth;
  }

  public absXChunktoSamples(absX: number, chunk: AudioChunk): number {
    const start = (chunk.time.start) ? chunk.time.start.samples : 1;
    const duration = chunk.time.end.samples - start;
    if (absX >= 0 && absX <= this.audioPxWidth) {
      const ratio = absX / this.audioPxWidth;
      return AudioTimeCalculator.roundSamples((duration * ratio) + chunk.time.start.samples);
    }

    return -1;
  }

  public absXtoSamples2(absX: number, chunk: AudioChunk): number {
    const start = (chunk.time.start) ? chunk.time.start.samples : 1;
    const duration = chunk.time.end.samples - start;
    if (absX >= 0 && absX <= this.audioPxWidth) {
      const ratio = absX / this.audioPxWidth;

      return AudioTimeCalculator.roundSamples(duration * ratio);
    }

    return -1;
  }

  public samplesToSeconds(samples: number): number {
    return (this.samplerate > 0 && samples > -1) ? (samples / this.samplerate) : 0;
  }

  public secondsToSamples(seconds: number): number {
    return (this.samplerate > 0 && seconds > -1) ? AudioTimeCalculator.roundSamples(seconds * this.samplerate) : 0;
  }
}
