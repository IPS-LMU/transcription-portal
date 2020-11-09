import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {Operation} from '../../obj/operations/operation';
import {AppInfo, ConverterData} from '../../app.info';
import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {FileInfo, isUnset} from '@octra/utilities';
import {Converter, IFile, OAnnotJSON, OAudiofile} from '@octra/annotation';
import {AudioInfo} from '@octra/media';

@Component({
  selector: 'app-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ResultsTableComponent implements OnChanges {

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
    if ((changes.hasOwnProperty('operation') && !isUnset(changes.operation.currentValue))) {
      this.generateTable();
    }
  }

  public onPreviewClick(file: File) {
    this.previewClick.emit(FileInfo.fromFileObject(file));

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public isUnequalResultType(converter: any) {
    if (!isUnset(this.conversionExtension)) {
      return this.conversionExtension !== `${converter.obj.name}`;
    }
    return false;
  }

  private generateTable() {
    this.convertedArray = [];
    this.conversionExtension = this.operation.resultType.replace('/json', '');
    this.cd.markForCheck();
    this.cd.detectChanges();

    if (this.operation.resultType !== '.wav') {
      const promises: Promise<string>[] = [];

      for (const result of this.operation.results) {
        promises.push(FileInfo.getFileContent(result.file));
      }

      // read all file contents of results
      Promise.all(promises).then((promiseResults: string[]) => {
        for (let j = 0; j < promiseResults.length; j++) {
          const result = this.operation.results[j];
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

          const audio: OAudiofile = new OAudiofile();
          audio.sampleRate = (this.operation.task.files[0] as AudioInfo).sampleRate;
          audio.duration = (this.operation.task.files[0] as AudioInfo).duration.samples;
          audio.name = (this.operation.task.files[0] as AudioInfo).fullname;
          audio.size = (this.operation.task.files[0] as AudioInfo).size;

          const file: IFile = {
            name: result.name,
            content: '',
            type: result.type,
            encoding: 'UTF-8'
          };

          const text = promiseResults[j];
          file.content = text;

          const convElem = {
            input: resultObj,
            conversions: [],
            number: j
          };
          this.convertedArray.push(convElem);
          this.convertedArray.sort(this.sortAlgorithm);

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

              let annotJSON;

              if (from.name !== 'AnnotJSON') {
                const importResult = from.import(file, audio);
                if (!isUnset(importResult)) {
                  if (!isUnset(importResult.error !== '')) {
                    annotJSON = from.import(file, audio).annotjson;
                  } else {
                    console.error(`importResult Error from ${from.name}: ${importResult.error}`);
                  }
                } else {
                  console.error(`importResult for import ${from.name} is undefined!`);
                }
              } else {
                annotJSON = JSON.parse(text);
              }

              const levelnum = this.getLevelNumforConverter(converter, annotJSON);

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
                convElem.conversions.push(res);
              }
            }
          }
        }

        this.cd.markForCheck();
        this.cd.detectChanges();
      }).catch((error) => {
        console.error(error);

        this.convertedArray.push({
          input: null,
          conversions: [],
          number: 0
        });
        this.convertedArray.sort(this.sortAlgorithm);

        this.cd.markForCheck();
        this.cd.detectChanges();
      });
    } else {
      for (let i = 0; i < this.operation.results.length; i++) {
        const result = this.operation.results[i];
        this.convertedArray.push({
          input: result,
          conversions: [],
          number: i
        });
      }
      this.convertedArray.sort(this.sortAlgorithm);

      this.cd.markForCheck();
      this.cd.detectChanges();
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

  private sortAlgorithm(a, b): number {
    if (a.number < b.number) {
      return 1;
    } else if (a.number === b.number) {
      return 0;
    } else if (a.number > b.number) {
      return -1;
    }
  }

  private getLevelNumforConverter(converterData: ConverterData, annotJSON: OAnnotJSON) {
    if (!isUnset(converterData.tierNameMatches)) {
      for (const tierNameMatch of converterData.tierNameMatches) {
        const regex = new RegExp(tierNameMatch, 'g');

        for (let i = 0; i < annotJSON.levels.length; i++) {
          const level = annotJSON.levels[i];
          if (regex.exec(level.name) !== null) {
            return i;
          }
        }
      }
      return -1;
    } else {
      return 0;
    }
  }

}
