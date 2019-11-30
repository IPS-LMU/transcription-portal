import {Converter, ExportResult, IFile, ImportResult} from './Converter';
import {OAnnotJSON, OAudiofile, OItem, OLabel, OLevel, OSegment} from '../Annotation';

export class PartiturConverter extends Converter {

  public constructor() {
    super();
    this._application = '';
    this._name = 'BAS Partitur Format';
    this._extension = '.par';
    this._website.title = 'BAS Partitur Format';
    this._website.url = 'http://www.bas.uni-muenchen.de/Bas/BasFormatsdeu.html';
    this._conversion.export = true;
    this._conversion.import = true;
    this._encoding = 'UTF-8';
    this._notice = 'While importing a .par file OCTRA combines TRN and ORT lines to one tier. ' +
      'This tier only consists of time aligned segments. For export OCTRA creates ORT and TRN lines from the transcription.';
    this._multitiers = false;
  }

  public export(annotation: OAnnotJSON, audiofile: OAudiofile, levelnum?: number): ExportResult {
    // TODO if levelnum not set, read levels with names "ORT" and "TRM" automatically
    if (!(levelnum === null || levelnum === undefined)) {
      const result: ExportResult = {
        file: {
          name: `${annotation.name}-${annotation.levels[levelnum].name}${this._extension}`,
          content: 'SAM ' + audiofile.samplerate,
          encoding: 'UTF-8',
          type: 'text'
        }
      };
      let content = `LHD: Partitur 1.3
SAM: ${audiofile.samplerate}
NCH: 1
LBD:\n`;

      let ort = [];
      const trn = [];

      let ortCounter = 0;

      for (const item of annotation.levels[levelnum].items) {
        const words = item.labels[0].value.split(' ');
        ort = ort.concat(words);
        let trnLine = `TRN: ${item.sampleStart} ${item.sampleDur} `;

        for (let k = 0; k < words.length; k++) {
          trnLine += `${ortCounter + k}`;
          if (k < words.length - 1) {
            trnLine += ',';
          }
        }
        ortCounter += words.length;
        trnLine += ` ${item.labels[0].value}\n`;
        trn.push(trnLine);
      }

      const kanLevel = annotation.levels.find((a) => {
        return a.name === 'KAN';
      });

      let j = 0;
      if (!(kanLevel === null || kanLevel === undefined)) {
        for (const kLevelItem of kanLevel.items) {
          if (kLevelItem.labels[0].value !== '') {
            content += `KAN: ${j} ${kLevelItem.labels[0].value}\n`;
            j++;
          }
        }
      }
      j = 0;

      for (const ortElem of ort) {
        if (ortElem !== '') {
          content += `ORT: ${j} ${ortElem}\n`;
          j++;
        }
      }
      for (const trnElem of trn) {
        content += trnElem;
      }

      j = 0;

      const mausLevel = annotation.levels.find((a) => {
        return a.name === 'MAU';
      });

      if (!(mausLevel === null || mausLevel === undefined)) {
        for (const mausItem of mausLevel.items) {
          if (mausItem.labels[0].value !== '') {
            content += `MAU: ${j} ${mausItem.labels[0].value}\n`;
            j++;
          }
        }
      }

      result.file.content = content;

      return result;
    }
    // levelnum is null;
    console.error('BASPartitur Converter needs a level number for export');
    return null;
  }

  public import(file: IFile, audiofile: OAudiofile): ImportResult {
    if (audiofile !== null && audiofile !== undefined) {
      const lines = file.content.split(/\r?\n/g);
      let pointer = 0;
      // const sam_found = lines[pointer].match(/SAM: ([0-9]+)/);
      /*
      if ((sam_found === null || sam_found === undefined)) {
        console.error(this._name + ' Converter Error: samplerate not found in .par file');
        return null;
      }
      const samplerate = Number(sam_found[1]);


      if (samplerate !== audiofile.samplerate) {
        console.error(this._name + ' Converter Error: samplerate of audiofile is not equal with samplerate of .par file.');
        return null;
      }
      pointer++;
      */

      const result = new OAnnotJSON(audiofile.name, audiofile.samplerate);
      const tiers = {};

      // skip not needed information and read needed information
      let previousTier = '';
      let level = null;
      let counter = 1;
      const start = 0;
      while (pointer < lines.length) {
        const search = lines[pointer].match(
          new RegExp(
            '(SAM)|(KAN)|(ORT)|(DAS)|(TR2)|(SUP)|(PRS)|(NOI)|(LBP)|(LBG)|(PRO)|(POS)|(LMA)|(SYN)|(FUN)|(LEX)|' +
            '(IPA)|(TRN)|(TRS)|(GES)|(USH)|(USM)|(OCC)|(USP)|(GES)|(TLN)|(PRM)|(TRW)|(MAS)'));
        if (!(search === null || search === undefined)) {
          const columns = lines[pointer].split(' ');

          if (search[0] === 'SAM') {
            if (audiofile.samplerate !== Number(columns[1])) {
              console.error(`Sample Rate of audio file is not equal to the value from Partitur file!`
                + `${audiofile.samplerate} !== ${columns[1]}`);
            }
          }

          if (search[0] === 'TRN') {
            if (previousTier !== search[0]) {
              if (level !== null) {
                result.levels.push(level);
              }
              level = (search[0] !== 'TRN') ? new OLevel(search[0], 'ITEM', []) : new OLevel(search[0], 'SEGMENT', []);
              previousTier = search[0];
              tiers[`${previousTier}`] = [];
            }
            if (previousTier !== 'TRN') {
              level.items.push(new OItem(counter, [new OLabel(previousTier, columns[2])]));
              tiers[`${previousTier}`].push(columns[2]);
            } else {
              const transcript = lines[pointer].match(new RegExp('TRN: ([0-9]+) ([0-9]+) ([0-9]+,?)+ (.*)'));
              level.items.push(new OSegment(
                counter, Number(transcript[1]), Number(transcript[2]), [new OLabel(previousTier, transcript[4])]
                )
              );
            }

            counter++;
          }
        }
        pointer++;
      }
      result.levels.push(level);

      return {
        annotjson: result,
        audiofile: null
      };
    }

    return null;
  }
}
