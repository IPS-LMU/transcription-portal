import {OAnnotJSON, OAudiofile} from './AnnotJSON';
import {Level} from './Level';
import {Link} from './Link';

export class Annotation {
  private readonly _annotates: string;
  private readonly _levels: Level[];

  constructor(annotates: string, audiofile: OAudiofile, levels?: Level[], links?: Link[]) {
    this._annotates = annotates;
    this._audiofile = audiofile;
    this._levels = [];
    this._links = [];

    if (!(levels === null || levels === undefined)) {
      this._levels = levels;
    }
    if (!(links === null || links === undefined)) {
      this._links = links;
    }
  }

  get levels(): Level[] {
    return this._levels;
  }

  get annotates(): string {
    return this._annotates;
  }

  private _audiofile: OAudiofile;

  get audiofile(): OAudiofile {
    return this._audiofile;
  }

  set audiofile(value: OAudiofile) {
    this._audiofile = value;
  }

  private _links: Link[];

  get links(): Link[] {
    return this._links;
  }

  set links(value: Link[]) {
    this._links = value;
  }

  public getObj(): OAnnotJSON {
    const result = new OAnnotJSON(this._audiofile.name, this._audiofile.samplerate, [], this._links);
    result.annotates = this._annotates;
    result.sampleRate = this._audiofile.samplerate;

    let startID = 1;
    for (const level of this._levels) {
      for (const item of level.items) {
        item.id = startID++;
        if (!(item.labels === null || item.labels === undefined) && item.labels.length > 0) {
          if (item.labels[0].name === '') {
            item.labels[0].name = level.name;
          }
        }
      }
      result.levels.push(level.getObj());
    }

    return result;
  }
}
