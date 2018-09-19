import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges
} from '@angular/core';
import {Operation} from '../../obj/operations/operation';
import {AppInfo} from '../../app.info';
import {Converter, IFile} from '../../obj/Converters';
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
  public convertedArray: {
    input: any,
    number: number,
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

  public originalLabel = '';

  public conversionExtension = '';
  @Output() previewClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();

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

    this.conversionExtension = this.operation.resultType;
    if (this.operation.resultType !== '.wav') {
      for (let i = 0; i < this.operation.results.length; i++) {
        const result = this.operation.results[i];
        let from = null;

        // TODO change this!
        for (let k = 0; k < AppInfo.converters.length; k++) {
          const converter = AppInfo.converters[k];
          if (converter.obj.extension.indexOf(result.extension) > -1) {
            this.originalLabel = converter.obj.extension;
            from = converter.obj;
            break;
          }
        }

        let originalFileName: any = this.operation.task.files[0].attributes.originalFileName;
        originalFileName = FileInfo.extractFileName(originalFileName);

        const resultObj = {
          url: this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(result.file)),
          name: originalFileName.name,
          type: result.type,
          available: result.available,
          fullname: originalFileName.name + result.extension,
          extension: result.extension,
          file: result.file
        };

        const file: IFile = {
          name: result.name,
          content: '',
          type: result.type,
          encoding: 'UTF-8'
        };

        const audio: OAudiofile = new OAudiofile();
        audio.samplerate = (<AudioInfo> this.operation.task.files[0]).samplerate;
        audio.duration = (<AudioInfo> this.operation.task.files[0]).duration.samples;
        audio.name = (<AudioInfo> this.operation.task.files[0]).name;
        audio.size = (<AudioInfo> this.operation.task.files[0]).size;

        FileInfo.getFileContent(result.file).then((text) => {
          file.content = text;

          const convElem = {
            input: resultObj,
            conversions: [],
            number: i
          };
          this.convertedArray.push(convElem);
          this.convertedArray = this.convertedArray.sort(this.sortAlgorithm);

          for (let k = 0; k < AppInfo.converters.length; k++) {
            const converter = AppInfo.converters[k];
            if (converter.obj.extension.indexOf(result.extension) < 0) {
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

              if (from.name !== 'AnnotJSON') {
                annotJSON = from.import(file, audio).annotjson;
              } else {
                annotJSON = JSON.parse(text);
              }

              const levelnum = 0;

              const preResult = converter.obj.export(annotJSON, audio, levelnum);
              const exp = (!(preResult === null || preResult === undefined))
                ? preResult.file : null;

              if (!(exp === null || exp === undefined)) {
                const expFile = new File([exp.content], originalFileName.name + converter.obj.extension, {
                  type: exp.type
                });
                res.result = FileInfo.fromFileObject(expFile);
                const url = URL.createObjectURL(expFile);
                res.result.url = this.sanitizer.bypassSecurityTrustUrl(url);
                res.state = 'FINISHED';
                this.cd.markForCheck();
                this.cd.detectChanges();
              }
            }
          }

          this.cd.markForCheck();
          this.cd.detectChanges();
        }).catch((err) => {
          this.convertedArray.push({
            input: result,
            conversions: [],
            number: i
          });
          console.error(err);
          this.convertedArray = this.convertedArray.sort(this.sortAlgorithm);
          this.cd.markForCheck();
        });
      }
    } else {
      let from = {
        extension: '.wav'
      };

      for (let i = 0; i < this.operation.results.length; i++) {
        const result = this.operation.results[i];
        this.convertedArray.push({
          input: result,
          conversions: [],
          number: i
        });
      }
      this.convertedArray = this.convertedArray.sort(this.sortAlgorithm);
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

  public onPreviewClick(file: File) {
    this.previewClick.emit(FileInfo.fromFileObject(file));

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  private sortAlgorithm(a, b): number {
    if (a.number < b.number) {
      return 1;
    } else if (a.number === b.number) {
      return 0;
    } else if (a.number > b.number) {
      return -1;
    }
  }

  public isEqualConverterName(converter: any) {
    return this.conversionExtension.indexOf(converter.obj.name) < 0;
  }

}
