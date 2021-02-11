import {ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges} from '@angular/core';
import {Operation} from '../../obj/operations/operation';
import {AppInfo, ConverterData} from '../../app.info';
import {HttpClient} from '@angular/common/http';
import {DomSanitizer} from '@angular/platform-browser';
import {FileInfo, isUnset} from '@octra/utilities';
import {Converter, OAudiofile} from '@octra/annotation';
import {AudioInfo} from '@octra/media';
import {DownloadService} from '../../shared/download.service';

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

  constructor(private http: HttpClient, private sanitizer: DomSanitizer,
              private cd: ChangeDetectorRef, private downloadService: DownloadService) {
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
      const promises: Promise<FileInfo[]>[] = [];

      for (const result of this.operation.results) {
        promises.push(this.downloadService.getConversionFiles(this.operation, this.operation.lastResult, this.converters));
      }

      // read all file contents of results
      Promise.all(promises).then((promiseResults: (FileInfo[])[]) => {
        for (let j = 0; j < promiseResults.length; j++) {
          const result = this.operation.results[j];
          const conversions = promiseResults[j];

          const from: ConverterData = AppInfo.converters.find(a => a.obj.extension.indexOf(result.extension) > -1);

          if (!isUnset(from)) {
            const importConverter = from.obj;
            this.originalLabel = importConverter.extension;


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

            const convElem = {
              input: resultObj,
              conversions: [],
              number: j
            };
            this.convertedArray.push(convElem);
            this.convertedArray.sort(this.sortAlgorithm);

            const convertersWithoutFrom = this.converters.filter(a => a.obj.name !== importConverter.name);

            for (let k = 0; k < conversions.length; k++) {
              const conversion = conversions[k];
              const converter = convertersWithoutFrom[k];

              const res: {
                converter: {
                  obj: Converter,
                  color: string
                }
                state: string;
                result: FileInfo;
              } = {
                converter: {
                  obj: converter.obj,
                  color: converter.color
                },
                state: 'PENDING',
                result: null
              };

              if (!isUnset(conversion)) {
                res.result = conversion;
                const url = URL.createObjectURL(conversion.file);
                res.result.url = this.sanitizer.bypassSecurityTrustUrl(url) as any;
                res.state = 'FINISHED';
                convElem.conversions.push(res);
              } else {
                res.state = 'FAILED';
              }
            }
          } else {
            console.error(`could not find import converter`);
          }
        }

        this.cd.markForCheck();
        this.cd.detectChanges();
      }).catch((error) => {
        console.error(error);

        this.convertedArray = [];
        this.convertedArray.push({
          input: null,
          conversions: [],
          number: 0
        });

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

}
