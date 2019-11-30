import {Segment} from './Segment';
import {AudioTime} from '../audio';
import {EventEmitter} from '@angular/core';
import {ISegment, OLabel, OSegment} from './AnnotJSON';

export class Segments {
  public onsegmentchange: EventEmitter<void> = new EventEmitter<void>();

  constructor(private sampleRate: number, segments: ISegment[], lastSample: number) {
    this._segments = [];

    if (segments !== null) {
      if (segments.length === 0) {
        this._segments.push(new Segment(new AudioTime(lastSample, sampleRate)));
      }

      for (const segment of segments) {
        const newSegment = Segment.fromObj(segment, sampleRate);
        this._segments.push(newSegment);
      }
    }
  }

  get length(): number {
    return this._segments.length;
  }

  private _segments: Segment[];

  get segments(): Segment[] {
    return this._segments;
  }

  set segments(value: Segment[]) {
    this._segments = value;
  }

  /**
   * adds new Segment
   */
  public add(timeSamples: number, transcript: string = null): boolean {
    const newSegment: Segment = new Segment(new AudioTime(timeSamples, this.sampleRate));

    if (!(transcript === null || transcript === undefined)) {
      newSegment.transcript = transcript;
    }

    this.segments.push(newSegment);
    this.sort();
    this.cleanup();
    return true;
  }

  /**
   * removes Segment by number of samples
   */
  public removeBySamples(timeSamples: number) {
    for (let i = 0; i < this.segments.length; i++) {
      if (this.segments[i].time.samples === timeSamples) {
        this.segments.splice(i, 1);

        this.onsegmentchange.emit();
      }
    }
  }

  public removeByIndex(index: number, breakmarker: string) {
    if (index > -1 && index < this.segments.length) {
      if (index < this.segments.length - 1) {
        const nextSegment = this.segments[index + 1];
        const transcription: string = this.segments[index].transcript;
        if (nextSegment.transcript !== breakmarker && transcription !== breakmarker) {
          // concat transcripts
          if (nextSegment.transcript !== '' && transcription !== '') {
            nextSegment.transcript = transcription + ' ' + nextSegment.transcript;
          } else if (nextSegment.transcript === '' && transcription !== '') {
            nextSegment.transcript = transcription;
          }
        } else if (nextSegment.transcript === breakmarker) {
          // delete pause
          nextSegment.transcript = transcription;
        }
      }

      this.segments.splice(index, 1);
      this.onsegmentchange.emit();
    }
  }

  /**
   * changes samples of segment by given index and sorts the List after adding
   */
  public change(i: number, segment: Segment): boolean {
    if (i > -1 && this._segments[i]) {
      const old = {
        samples: this._segments[i].time.samples,
        transcript: this._segments[i].transcript
      };

      this._segments[i].time.samples = segment.time.samples;
      this._segments[i].transcript = segment.transcript;

      if (old.samples !== segment.time.samples || old.transcript !== segment.transcript) {
        this.onsegmentchange.emit();
        return true;
      }
    }
    return false;
  }

  /**
   * sorts the segments by time in samples
   */
  public sort() {
    this.segments.sort((a, b) => {
      if (a.time.samples < b.time.samples) {
        return -1;
      }
      if (a.time.samples === b.time.samples) {
        return 0;
      }
      if (a.time.samples > b.time.samples) {
        return 1;
      }
    });

    this.onsegmentchange.emit();
  }

  /**
   * gets Segment by index
   */
  public get(i: number): Segment {
    if (i > -1 && i < this.segments.length) {
      return this.segments[i];
    }
    return null;
  }

  public getFullTranscription(): string {
    let result = '';

    for (const segment of this.segments) {
      result += ' ' + segment.transcript;
    }

    return result;
  }

  public getSegmentBySamplePosition(samples: number): number {
    let begin = 0;
    for (let i = 0; i < this._segments.length; i++) {
      if (i > 0) {
        begin = this._segments[i - 1].time.samples;
      }
      if (samples > begin && samples <= this._segments[i].time.samples) {
        return i;
      }
    }
    return -1;
  }

  public getSegmentsOfRange(startSamples: number, endSamples: number): Segment[] {
    const result: Segment[] = [];
    let start = 0;

    for (const segment of this._segments) {
      if (
        (segment.time.samples >= startSamples && segment.time.samples <= endSamples) ||
        (start >= startSamples && start <= endSamples)
        ||
        (start <= startSamples && segment.time.samples >= endSamples)

      ) {
        result.push(segment);
      }
      start = segment.time.samples;
    }

    return result;
  }

  public getStartTime(id: number): AudioTime {
    const segment = this.get(id);
    let samples = 0;

    if (segment) {
      for (let i = 0; i < this.segments.length; i++) {
        if (id === i) {
          const res = segment.time.clone();
          res.samples = samples;
          return res;
        }

        samples = this.get(i).time.samples;
      }
    }
    return null;
  }

  public BetweenWhichSegment(samples: number): Segment {
    let start = 0;

    for (const segment of this.segments) {
      if (samples >= start && samples <= segment.time.samples) {
        return segment;
      }
      start = segment.time.samples;
    }

    return null;
  }

  public clear() {
    this._segments = [];
  }

  public getObj(labelname: string): OSegment[] {
    const result: OSegment[] = [];

    let start = 0;
    for (let i = 0; i < this._segments.length; i++) {
      const segment = this._segments[i];
      const labels: OLabel[] = [];
      labels.push(new OLabel(labelname, segment.transcript));

      const annotSegment = new OSegment((i + 1), start, (segment.time.samples - start), labels);
      result.push(annotSegment);

      start = segment.time.samples;
    }

    return result;
  }

  public clone(): Segments {
    const result = new Segments(this.sampleRate, null, this.segments[this.length - 1].time.samples);
    for (const segment of this.segments) {
      result.add(segment.time.samples, segment.transcript);
    }
    return result;
  }

  private cleanup() {
    const remove: number[] = [];

    for (let i = 0; i < this.segments.length; i++) {
      if (i > 0) {
        const last = this.segments[i - 1];
        if (last.time.samples === this.segments[i].time.samples) {
          remove.push(i);
        }
      }
    }

    for (let i = 0; i < remove.length; i++) {
      this.segments.splice(remove[i], 1);
      remove.splice(i, 1);
      --i;
    }
  }
}
