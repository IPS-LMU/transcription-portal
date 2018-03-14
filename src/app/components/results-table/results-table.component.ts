import {Component, Input, OnChanges, OnInit, SimpleChanges} from '@angular/core';
import {Operation} from '../../obj/tasks/operation';
import {AppInfo} from '../../app.info';
import {Converter, IFile} from '../../obj/Converters';
import {isNullOrUndefined} from 'util';
import {OAudiofile} from '../../obj/Annotation';
import {AudioInfo} from '../../obj/audio';
import {HttpClient} from '@angular/common/http';
import {FileInfo} from '../../obj/fileInfo';
import {DomSanitizer} from '@angular/platform-browser';

@Component({
  selector: 'app-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.css']
})
export class ResultsTableComponent implements OnInit, OnChanges {

  @Input() operation: Operation;
  public convertedArray: {
    input: FileInfo,
    conversions: {
      converter: {
        obj: Converter,
        color: string
      }
      state: string;
      result: FileInfo;
    }[];
  }[] = [];

  public get AppInfo(): AppInfo {
    return new AppInfo();
  }

  public conversionExtension = '';

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('operation') && !changes.operation.isFirstChange()) {
      this.generateTable();
    }
  }

  ngOnInit() {
    this.generateTable();
  }

  private generateTable() {
    this.convertedArray = [];
    let from: Converter;
    for (let i = 0; i < this.AppInfo.converters.length; i++) {
      const converter = this.AppInfo.converters[i];
      if (converter.obj.name === this.operation.resultType) {
        from = converter.obj;
      }
      console.log(`${converter.obj.name} === ${this.operation.resultType}`);
    }

    if (!isNullOrUndefined(from)) {
      this.conversionExtension = from.name;
      console.log(`converter is ${from.name}`);
      console.log(`operation has ${this.operation.results.length} results!`);
      for (let i = 0; i < this.operation.results.length; i++) {
        const result = this.operation.results[i];
        const file: IFile = {
          name: result.name,
          content: '',
          type: result.type,
          encoding: 'UTF-8'
        };

        const audio: OAudiofile = new OAudiofile();
        audio.samplerate = (<AudioInfo> this.operation.task.files[0]).samplerate;
        audio.duration = (<AudioInfo> this.operation.task.files[0]).duration.seconds;
        audio.name = (<AudioInfo> this.operation.task.files[0]).name;
        audio.size = (<AudioInfo> this.operation.task.files[0]).size;

        this.downloadResult(result).then((text) => {
          console.log(`Import:`);
          console.log(text);
          file.content = text;

          const convElem = {
            input: result,
            conversions: []
          };
          this.convertedArray.push(convElem);

          for (let k = 0; k < this.AppInfo.converters.length; k++) {
            const converter = this.AppInfo.converters[k];
            if (converter.obj.name !== this.operation.resultType) {
              const res = {
                converter: converter,
                state: 'PENDING',
                result: null
              };
              convElem.conversions.push(res);

              let annotJSON;

              if (from.name !== 'AnnotJSON') {
                annotJSON = from.import(file, audio).annotjson;
              } else {
                annotJSON = JSON.parse(text);
              }
              const exp = converter.obj.export(annotJSON, audio, 0).file;
              const expFile = new File([exp.content], exp.name, {
                type: exp.type
              });
              res.result = FileInfo.fromFileObject(expFile);
              res.result.url = this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(expFile));
              console.log(`exported!`);
              res.state = 'FINISHED';
              console.log(exp.content);
            }
          }
        }).catch((err) => {
          console.error(err);
        })
      }
    } else {
      this.conversionExtension = this.operation.resultType;

      for (let i = 0; i < this.operation.results.length; i++) {
        const result = this.operation.results[i];
        this.convertedArray.push({
          input: result,
          conversions: []
        })
      }
    }
  }

  private downloadResult(result: FileInfo): Promise<string> {
    return new Promise<string>((resolve, reject) => {

      if (result.online) {
        this.http.get(result.url, {
          responseType: 'text'
        }).subscribe(
          (text) => {
            resolve(text);
          },
          (err) => {
            reject(err);
          }
        );
      } else {
        reject('result is not online!');
      }
    });
  }

}
