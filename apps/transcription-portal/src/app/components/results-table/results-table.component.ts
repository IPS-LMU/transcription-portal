import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { Converter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { hasProperty, last } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { timer } from 'rxjs';
import { AppInfo, ConverterData } from '../../app.info';
import { TPortalAudioInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { DownloadService } from '../../shared/download.service';
import { OperationFactory, StoreItemTask, StoreTaskOperation } from '../../store';
import { convertStoreFileToFileInfo } from '../../store/operation/operation.functions';

@Component({
  selector: 'tportal-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.scss'],
  imports: [NgStyle, FormsModule],
})
export class ResultsTableComponent implements OnChanges {
  private sanitizer = inject(DomSanitizer);
  protected cd = inject(ChangeDetectorRef);
  private downloadService = inject(DownloadService);

  @Input() operation?: StoreTaskOperation;
  @Input() task?: StoreItemTask;
  @Input() defaultOperations?:
    | {
        factory: OperationFactory<any>;
        enabled: boolean;
      }[]
    | null = [];
  @Input() visible = false;

  somethingClicked = false;

  public convertedArray: {
    originalResults?: {
      url: SafeUrl;
      info: TPortalFileInfo;
    }[];
    number: number;
    conversions: {
      converter: {
        obj: Converter;
        color: string;
      };
      state: string;
      result: TPortalFileInfo;
    }[];
  }[] = [];
  public originalLabel = '';
  public conversionExtension = '';
  private oldOperation = {
    id: -1,
    numOfResults: -1,
  };

  private generationRunning = false;

  @Output() previewClick: EventEmitter<TPortalFileInfo> = new EventEmitter<TPortalFileInfo>();
  selectedVersion = '0';

  public get converters() {
    return AppInfo.converters;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (this.visible && this.task && this.operation) {
      if (this.oldOperation.id !== this.operation.id || this.oldOperation.numOfResults !== this.operation.rounds.length) {
        if (!this.generationRunning) {
          this.generationRunning = true;
          this.generateTable();
        }
      }
    } else if (hasProperty(changes, 'visible') && changes['visible'].currentValue && !changes['visible'].previousValue) {
      this.generationRunning = false;
      this.somethingClicked = false;
    }
  }

  public onPreviewClick(file: TPortalFileInfo) {
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
      v.originalResults?.forEach((a) => {
        revokeURLIfNeeded((a.url as any)?.changingThisBreaksApplicationSecurity);
      });
      v.conversions.forEach((s) => {
        revokeURLIfNeeded(s.result.url);
      });
    });
    this.convertedArray = [];
  }

  private generateTable() {
    this.clearConvertedArray();
    const opFactory = (this.defaultOperations ?? []).find((a) => a.factory.name === this.operation?.name)?.factory;

    if (this.task && this.operation && opFactory?.resultType) {
      this.conversionExtension = opFactory.resultType.replace('/json', '');

      if (opFactory.resultType !== '.wav') {
        const promises: Promise<TPortalFileInfo[]>[] = [];

        for (const round of this.operation.rounds) {
          promises.push(this.downloadService.getConversionFiles(this.task, this.operation, round, this.converters));
        }

        // read all file contents of results
        Promise.all(promises)
          .then((promiseResults: TPortalFileInfo[][]) => {
            if (this.operation && this.task) {
              for (let j = 0; j < promiseResults.length; j++) {
                const result = last(this.operation.rounds[j].results);
                const conversions = promiseResults[j];
                const { extension } = FileInfo.extractFileName(result!.name);

                const from: ConverterData | undefined = AppInfo.converters.find(
                  (a) =>
                    a.obj.extensions.findIndex((b) => {
                      return b.indexOf(extension) > -1;
                    }) > -1,
                );

                if (from) {
                  const importConverter = from.obj;
                  this.originalLabel = importConverter.extensions[0];

                  if (!result?.content) {
                    throw new Error(`result content is undefined`);
                  }

                  let originalFileName: any = this.task.files[0].attributes?.originalFileName ?? this.task.files[0].name;
                  originalFileName = TPortalFileInfo.extractFileName(originalFileName);

                  const fileInfo = convertStoreFileToFileInfo(result);
                  fileInfo.file = new File([result.content!], result.name, { type: result.type })
                  fileInfo.url = URL.createObjectURL(fileInfo.file);
                  fileInfo.attributes = {
                    ...result.attributes,
                    originalFileName: `${originalFileName.name}${extension}`,
                  };

                  const resultObj = {
                    url: fileInfo.url,
                    info: fileInfo,
                  };

                  const audio: OAudiofile = new OAudiofile();
                  if (this.task) {
                    audio.sampleRate = (this.task.files[0] as TPortalAudioInfo).sampleRate;
                    audio.duration = (this.task.files[0] as TPortalAudioInfo).duration.samples;
                    audio.name = (this.task.files[0] as TPortalAudioInfo).fullname;
                    audio.size = (this.task.files[0] as TPortalAudioInfo).size;
                  }

                  const convElem = {
                    originalResults: [resultObj],
                    conversions: [] as any[],
                    number: j,
                  };
                  this.convertedArray.push(convElem);
                  this.convertedArray.sort(this.sortAlgorithm);

                  const convertersWithoutFrom = this.converters.filter((a) => a.obj.name !== importConverter.name);

                  for (let k = 0; k < conversions.length; k++) {
                    const conversion = conversions[k];
                    const converter = convertersWithoutFrom[k];

                    const res: {
                      converter: {
                        obj: Converter;
                        color: string;
                      };
                      state: string;
                      result?: TPortalFileInfo;
                    } = {
                      converter: {
                        obj: converter.obj,
                        color: converter.color,
                      },
                      state: 'PENDING',
                    };

                    if (conversion) {
                      res.result = conversion;
                      const url = conversion.file ? URL.createObjectURL(conversion.file) : '';
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
        for (let i = 0; i < this.operation.rounds.length; i++) {
          const round = this.operation.rounds[i];
          this.convertedArray.push({
            originalResults: round.results.map((a) => ({
              url: a.url ?? '',
              info: convertStoreFileToFileInfo(a),
            })),
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
    this.selectedVersion = ((this.operation?.rounds.length ?? 1) - 1).toString();
    this.cd.markForCheck();
    this.cd.detectChanges();

    if (this.operation) {
      this.oldOperation = {
        id: this.operation.id,
        numOfResults: this.operation.rounds.length,
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
