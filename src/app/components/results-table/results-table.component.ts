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
import {isUnset} from '@octra/utilities';

@Component({
  selector: 'app-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsTableComponent implements OnInit, OnChanges {

  @Input() operation: Operation;
  @Input() visible = false;

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
  public originalLabel = '';
  public conversionExtension = '';
  @Output() previewClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();

  constructor(private http: HttpClient, private sanitizer: DomSanitizer, private cd: ChangeDetectorRef) {
  }

  public get converters() {
    return AppInfo.converters;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('visible') && !changes.visible.isFirstChange() && changes.visible.currentValue === true) {
      this.generateTable();
    }
  }

  ngOnInit() {
    console.log(`init!`);
    this.generateTable();
  }

  public onPreviewClick(file: File) {
    this.previewClick.emit(FileInfo.fromFileObject(file));

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public isEqualConverterName(converter: any) {
    if (!isUnset(this.conversionExtension)) {
      return this.conversionExtension.indexOf(converter.obj.name) < 0;
    }
    return false;
  }

  private generateTable() {
    this.convertedArray = [];
    this.cd.markForCheck();
    this.cd.detectChanges();

    this.conversionExtension = this.operation.resultType;
    if (this.operation.resultType !== '.wav') {
      for (let i = 0; i < this.operation.results.length; i++) {
        const result = this.operation.results[i];
        let from: Converter = null;

        // TODO change this!
        for (const converter of AppInfo.converters) {
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
        audio.samplerate = (this.operation.task.files[0] as AudioInfo).samplerate;
        audio.duration = (this.operation.task.files[0] as AudioInfo).duration.samples;
        audio.name = (this.operation.task.files[0] as AudioInfo).fullname;
        audio.size = (this.operation.task.files[0] as AudioInfo).size;

        FileInfo.getFileContent(result.file).then((text) => {
          file.content = text;

          const convElem = {
            input: resultObj,
            conversions: [],
            number: i
          };
          this.convertedArray.push(convElem);
          this.convertedArray = this.convertedArray.sort(this.sortAlgorithm);

          for (const converter of AppInfo.converters) {
            if (converter.obj.extension.indexOf(result.extension) < 0) {
              const res: {
                converter: any,
                state: string,
                result: any
              } = {
                converter,
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

              let preResult = null;

              try {
                preResult = converter.obj.export(annotJSON, audio, levelnum);
              } catch (e) {
                console.log(e);
              }

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
          this.cd.detectChanges();
        });
      }
    } else {
      const from = {
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

  private sortAlgorithm(a, b): number {
    if (a.number < b.number) {
      return 1;
    } else if (a.number === b.number) {
      return 0;
    } else if (a.number > b.number) {
      return -1;
    }
  }

}
