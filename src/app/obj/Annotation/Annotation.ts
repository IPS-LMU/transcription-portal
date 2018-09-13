import {OAnnotJSON, OAudiofile} from './AnnotJSON';
import {Level} from './Level';
import {Link} from './Link';

export class Annotation {
  set links(value: Link[]) {
    this._links = value;
  }

  get levels(): Level[] {
    return this._levels;
  }

  get links(): Link[] {
    return this._links;
  }

  get annotates(): string {
    return this._annotates;
  }

  get audiofile(): OAudiofile {
    return this._audiofile;
  }

  set audiofile(value: OAudiofile) {
    this._audiofile = value;
  }

  private _annotates: string;
  private _audiofile: OAudiofile;
  private _levels: Level[];
  private _links: Link[];

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

  public getObj(): OAnnotJSON {
    const result = new OAnnotJSON(this._audiofile.name, this._audiofile.samplerate, [], this._links);
    result.annotates = this._annotates;
    result.sampleRate = this._audiofile.samplerate;

    let start_id = 1;
    for (let i = 0; i < this._levels.length; i++) {
      const level = this._levels[i].getObj();
      for (let j = 0; j < level.items.length; j++) {
        level.items[j].id = start_id++;
        if (!(level.items[j].labels === null || level.items[j].labels === undefined) && level.items[j].labels.length > 0) {
          if (level.items[j].labels[0].name === '') {
            level.items[j].labels[0].name = level.name;
          }
        }
      }
      result.levels.push(level);
    }

    return result;
  }
}
