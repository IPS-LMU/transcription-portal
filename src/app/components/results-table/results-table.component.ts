import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';
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
  styleUrls: ['./results-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsTableComponent implements OnInit, OnChanges {

  @Input() operation: Operation;
  public from: any;
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
    return AppInfo;
  }

  public conversionExtension = '';

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, private cd: ChangeDetectorRef) {
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
    this.from = null;
    for (let i = 0; i < AppInfo.converters.length; i++) {
      const converter = AppInfo.converters[i];
      if (converter.obj.name === this.operation.resultType) {
        this.from = converter.obj;
      }
    }

    if (!isNullOrUndefined(this.from)) {
      this.conversionExtension = this.from.name;
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
          file.content = text;

          const convElem = {
            input: result,
            conversions: []
          };
          this.convertedArray.push(convElem);

          for (let k = 0; k < AppInfo.converters.length; k++) {
            const converter = AppInfo.converters[k];
            if (converter.obj.name !== this.operation.resultType) {
              const res: {
                converter: any,
                state: string,
                result: any
              } = {
                converter: converter,
                state: 'PENDING',
                result: null
              };
              convElem.conversions.push(res);

              let annotJSON;

              if (this.from.name !== 'AnnotJSON') {
                annotJSON = this.from.import(file, audio).annotjson;
              } else {
                annotJSON = JSON.parse(text);
              }
              const exp = converter.obj.export(annotJSON, audio, 0).file;
              const expFile = new File([exp.content], exp.name, {
                type: exp.type
              });
              res.result = FileInfo.fromFileObject(expFile);
              const url = URL.createObjectURL(expFile);
              res.result.url = this.sanitizer.bypassSecurityTrustUrl(url);
              res.state = 'FINISHED';
            }
          }

          this.cd.markForCheck();
          this.cd.detectChanges();
        }).catch(() => {
          this.convertedArray.push({
            input: result,
            conversions: []
          });
          this.cd.markForCheck();
          this.cd.detectChanges();
        })
      }
    } else {
      this.conversionExtension = this.operation.resultType;
      this.from = {
        extension: '.wav'
      };
      for (let i = 0; i < this.operation.results.length; i++) {
        const result = this.operation.results[i];
        this.convertedArray.push({
          input: result,
          conversions: []
        })
      }
    }

    this.cd.markForCheck();
    this.cd.detectChanges();
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
