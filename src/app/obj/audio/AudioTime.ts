/**
 * class initialized with samples which can output other units like seconds, miliseconds
 */
export class AudioTime {
  constructor(private _samples: number,
              private _sampleRate: number) {
    if (this._sampleRate <= 0) {
      throw new Error('sample_rate must be bigger than 0');
    }
  }

  set sample_rate(value) {
    this._sampleRate = value;
  }

  get samples(): number {
    return this._samples;
  }

  set samples(value: number) {
    this._samples = value;
  }

  get unix(): number {
    return Math.floor((this.samples * 1000) / this._sampleRate);
  }

  set unix(value: number) {
    this._samples = Math.round((value / 1000) * this._sampleRate);
  }

  get seconds(): number {
    return this.samples / this._sampleRate;
  }

  set seconds(value: number) {
    this.samples = value * this._sampleRate;
  }

  /**
   * converts seconds given sample_rate to Audiotime
   */
  public static fromSeconds(seconds: number, sampleRate: number): AudioTime {
    return new AudioTime(seconds * sampleRate, sampleRate);
  }

  /**
   * converts miliseconds given sample_rate to Audiotime
   */
  public static fromMiliSeconds(miliseconds: number, sampleRate: number): AudioTime {
    return new AudioTime(miliseconds / 1000 * sampleRate, sampleRate);
  }

  /**
   * sums two Audiotimes with the same sample rate and returns the result as new AudioTime.
   */
  public static add(time1: AudioTime, time2: AudioTime): AudioTime {
    if (time1._sampleRate === time2._sampleRate) {
      return new AudioTime(
        time1.samples + time2.samples, time1._sampleRate
      );

    } else {
      throw new Error('Two AudioTime Objects of different sample_rates can not be added.');
    }
  }

  /**
   * subs two AudioTimes with the same sample_rate and returns the result as new AudioTime
   */
  public static sub(time1: AudioTime, time2: AudioTime): AudioTime {
    if (time1._sampleRate === time2._sampleRate) {
      return new AudioTime(
        time1.samples - time2.samples, time1._sampleRate
      );

    } else {
      throw new Error('Two AudioTime Objects of different sample_rates can not be added.');
    }
  }

  public static fromSamples(samples: number, samplerate: number): AudioTime {
    if (!(samples === null || samples === undefined) && !(samplerate === null
      || samplerate === undefined) && Number.isInteger(samples) && samples > -1) {
      return new AudioTime(samples, samplerate);
    }
    return null;
  }

  public clone(): AudioTime {
    return new AudioTime(this.samples, this._sampleRate);
  }

  public toString(): string {
    return 'Samples: ' + this.samples;
  }

  public toAny(): any {
    return {
      samples: this._samples,
      sample_rate: this._sampleRate
    };
  }
}
