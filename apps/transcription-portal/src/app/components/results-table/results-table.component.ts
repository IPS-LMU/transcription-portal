import { NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Converter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { hasProperty } from '@octra/utilities';
import { AudioInfo, FileInfo } from '@octra/web-media';
import { timer } from 'rxjs';
import { AppInfo, ConverterData } from '../../app.info';
import { Operation } from '../../obj/operations/operation';
import { DownloadService } from '../../shared/download.service';

@Component({
  selector: 'tportal-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgStyle, FormsModule],
})
export class ResultsTableComponent implements OnChanges {
  @Input() operation?: Operation;
  @Input() visible = false;

  somethingClicked = false;

  public convertedArray: {
    input?: {
      url: SafeUrl;
      info: FileInfo;
    };
    number: number;
    conversions: {
      converter: {
        obj: Converter;
        color: string;
      };
      state: string;
      result: FileInfo;
    }[];
  }[] = [];
  public originalLabel = '';
  public conversionExtension = '';
  private oldOperation = {
    id: -1,
    numOfResults: -1,
  };

  private generationRunning = false;

  @Output() previewClick: EventEmitter<FileInfo> = new EventEmitter<FileInfo>();
  selectedVersion = '0';

  constructor(
    private sanitizer: DomSanitizer,
    protected cd: ChangeDetectorRef,
    private downloadService: DownloadService,
  ) {}

  public get converters() {
    return AppInfo.converters;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      ((hasProperty(changes, 'operation') &&
        changes['operation'].currentValue) ||
        (hasProperty(changes, 'visible') &&
          changes['visible'].currentValue &&
          changes['visible'].currentValue)) &&
      this.operation
    ) {
      if (
        this.oldOperation.id !== this.operation.id ||
        this.oldOperation.numOfResults !== this.operation.results.length
      ) {
        if (!this.generationRunning) {
          this.generationRunning = true;
          this.generateTable();
        }
      }
    } else if (
      hasProperty(changes, 'visible') &&
      changes['visible'].currentValue &&
      !changes['visible'].previousValue
    ) {
      this.generationRunning = false;
      this.somethingClicked = false;
    }
  }

  public onPreviewClick(file: FileInfo) {
    this.visible = false;
    this.cd.markForCheck();

    this.previewClick.emit(file);
    this.cd.markForCheck();
  }

  public isUnequalResultType(converter: any) {
    if (this.conversionExtension) {
      return this.conversionExtension !== `${converter.obj.name}`;
    }
    return false;
  }

  private clearConvertedArray() {
    const revokeURLIfNeeded = (url?: string) => {
      if (url && /^blob:/g.exec(url.toString()) !== null) {
        URL.revokeObjectURL(url);
      }
    };
    this.convertedArray.forEach((v) => {
      revokeURLIfNeeded(
        (v.input?.url as any)?.changingThisBreaksApplicationSecurity,
      );
      v.conversions.forEach((s) => {
        revokeURLIfNeeded(s.result.url);
      });
    });
    this.convertedArray = [];
  }

  private generateTable() {
    this.clearConvertedArray();
    if (this.operation && this.operation.resultType) {
      this.conversionExtension = this.operation.resultType.replace('/json', '');

      if (this.operation.resultType !== '.wav') {
        const promises: Promise<FileInfo[]>[] = [];

        for (const result of this.operation.results) {
          promises.push(
            this.downloadService.getConversionFiles(
              this.operation,
              this.operation.lastResult,
              this.converters,
            ),
          );
        }

        // read all file contents of results
        Promise.all(promises)
          .then((promiseResults: FileInfo[][]) => {
            if (this.operation) {
              for (let j = 0; j < promiseResults.length; j++) {
                const result = this.operation.results[j];
                const conversions = promiseResults[j];

                const from: ConverterData | undefined = AppInfo.converters.find(
                  (a) =>
                    a.obj.extensions.findIndex(
                      (b) => b.indexOf(result.extension) > -1,
                    ) > -1,
                );

                if (from) {
                  const importConverter = from.obj;
                  this.originalLabel = importConverter.extensions[0];

                  if (!result.file) {
                    throw new Error(`result file is undefined`);
                  }

                  let originalFileName: any =
                    this.operation?.task?.files[0].attributes
                      .originalFileName ??
                    this.operation?.task?.files[0].fullname;
                  originalFileName = FileInfo.extractFileName(originalFileName);

                  const fileInfo = new FileInfo(
                    result.file.name,
                    result.type,
                    result.size,
                    result.file,
                    result.createdAt,
                  );
                  fileInfo.url = result.file
                    ? URL.createObjectURL(result.file)
                    : '';
                  fileInfo.attributes = {
                    originalFileName: `${originalFileName.name}${result.extension}`,
                  };

                  const resultObj = {
                    url: result.file
                      ? this.sanitizer.bypassSecurityTrustUrl(
                          URL.createObjectURL(result.file),
                        )
                      : '',
                    info: fileInfo,
                  };

                  const audio: OAudiofile = new OAudiofile();
                  if (this.operation.task) {
                    audio.sampleRate = (
                      this.operation.task.files[0] as AudioInfo
                    ).sampleRate;
                    audio.duration = (
                      this.operation.task.files[0] as AudioInfo
                    ).duration.samples;
                    audio.name = resultObj.info.fullname;
                    audio.size = (
                      this.operation.task.files[0] as AudioInfo
                    ).size;
                  }

                  const convElem = {
                    input: resultObj,
                    conversions: [] as any[],
                    number: j,
                  };
                  this.convertedArray.push(convElem);
                  this.convertedArray.sort(this.sortAlgorithm);

                  const convertersWithoutFrom = this.converters.filter(
                    (a) => a.obj.name !== importConverter.name,
                  );

                  for (let k = 0; k < conversions.length; k++) {
                    const conversion = conversions[k];
                    const converter = convertersWithoutFrom[k];

                    const res: {
                      converter: {
                        obj: Converter;
                        color: string;
                      };
                      state: string;
                      result?: FileInfo;
                    } = {
                      converter: {
                        obj: converter.obj,
                        color: converter.color,
                      },
                      state: 'PENDING',
                    };

                    if (conversion) {
                      res.result = conversion;
                      const url = conversion.file
                        ? URL.createObjectURL(conversion.file)
                        : '';
                      res.result.url = this.sanitizer.bypassSecurityTrustUrl(
                        url,
                      ) as any;
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

              this.updateGUI();
            }
          })
          .catch((error) => {
            console.error(error);

            this.convertedArray = [];
            this.convertedArray.push({
              conversions: [],
              number: 0,
            });

            this.updateGUI();
          });
      } else {
        for (let i = 0; i < this.operation.results.length; i++) {
          const result = this.operation.results[i];
          this.convertedArray.push({
            input: {
              url: result.url ?? '',
              info: result,
            },
            conversions: [],
            number: i,
          });
        }
        this.convertedArray.sort(this.sortAlgorithm);
        this.updateGUI();
      }
    }
  }

  private updateGUI() {
    this.selectedVersion = (
      (this.operation?.results.length ?? 1) - 1
    ).toString();
    this.cd.markForCheck();
    this.cd.detectChanges();
    if (this.operation) {
      this.oldOperation = {
        id: this.operation.id,
        numOfResults: this.operation.results.length,
      };
      this.generationRunning = false;
    }
  }

  private sortAlgorithm(a: any, b: any): number {
    if (a.number < b.number) {
      return 1;
    } else if (a.number === b.number) {
      return 0;
    }
    return -1;
  }

  test() {
    alert('Ok');
  }

  disableClick($event: MouseEvent) {
    this.somethingClicked = true;
    timer(300).subscribe({
      next: () => {
        this.somethingClicked = false;
      },
    });
  }
}
