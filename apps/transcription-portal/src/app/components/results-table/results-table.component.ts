import { NgStyle } from '@angular/common';
import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, Output, SimpleChanges, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Converter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { hasProperty, last } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { AppInfo, ConverterData } from '../../app.info';
import { TPortalAudioInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { DownloadService } from '../../shared/download.service';
import { OperationFactory, StoreItemTask, StoreTaskOperation } from '../../store';
import { convertStoreFileToFileInfo } from '../../store/operation/operation.functions';

@Component({
  selector: 'tportal-results-table',
  templateUrl: './results-table.component.html',
  styleUrls: ['./results-table.component.scss'],
  imports: [NgStyle, FormsModule, TranslocoPipe]
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

  public convertedArray?: {
    originalResults?: {
      url: SafeUrl;
      info: TPortalFileInfo;
    }[];
    conversions: {
      converter: {
        obj: Converter;
        color: string;
      };
      state: string;
      result?: TPortalFileInfo;
    }[];
  };
  public originalLabel = '';
  public conversionExtension = '';
  private oldOperation = {
    id: -1,
    numOfResults: -1,
  };

  private generationRunning = false;

  @Output() previewClick: EventEmitter<TPortalFileInfo> = new EventEmitter<TPortalFileInfo>();
  @Input() selectedVersion = 0;

  public get converters() {
    return AppInfo.converters;
  }

  async ngOnChanges(changes: SimpleChanges) {
    if (this.visible && this.task && this.operation) {
      if (this.oldOperation.id !== this.operation.id || this.oldOperation.numOfResults !== this.operation.rounds.length) {
        if (!this.generationRunning) {
          this.generationRunning = true;
          await this.generateTable();
        }
      } else if (changes['selectedVersion']?.currentValue !== undefined) {
        this.generationRunning = true;
        await this.generateTable();
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

  private clearConvertedArray() {
    const revokeURLIfNeeded = (url?: string) => {
      if (url && /^blob:/g.exec(url.toString()) !== null) {
        URL.revokeObjectURL(url);
      }
    };
    this.convertedArray = {
      originalResults: this.convertedArray?.originalResults?.map((a) => {
        revokeURLIfNeeded((a.url as any)?.changingThisBreaksApplicationSecurity);
        return a;
      }),
      conversions:
        this.convertedArray?.conversions.map((a) => {
          if (a.result?.url) {
            revokeURLIfNeeded(a.result.url);
          }
          return a;
        }) ?? [],
    };
    this.convertedArray = undefined;
  }

  private async generateTable() {
    this.clearConvertedArray();
    const opFactory = (this.defaultOperations ?? []).find((a) => a.factory.name === this.operation?.name)?.factory;

    if (this.task && this.operation && opFactory?.resultType) {
      this.conversionExtension = opFactory.resultType.replace('/json', '');

      if (opFactory.name !== 'Upload') {
        try {
          const conversions = await this.downloadService.getConversionFiles(
            this.task,
            this.operation,
            this.operation.rounds[this.selectedVersion],
            this.converters,
          );

          if (this.operation && this.task) {
            const results = this.operation.rounds[this.selectedVersion].results;

            if (results.length > 0) {
              const result = last(results);
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
                fileInfo.file = new File([result.content!], result.name, { type: result.type });
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

                this.convertedArray = {
                  originalResults: [resultObj],
                  conversions: [] as any[],
                };

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
                    this.convertedArray.conversions.push(res);
                  } else {
                    res.state = 'FAILED';
                  }
                }
              } else {
                console.error(`could not find import converter`);
              }
            } else {
              this.convertedArray = {
                originalResults: [],
                conversions: [],
              };
            }

            this.updateGUI();
          }
        } catch (e) {
          console.error(e);
          this.convertedArray = undefined;
          this.updateGUI();
        }
      } else {
        for (let i = 0; i < this.operation.rounds.length; i++) {
          const round = this.operation.rounds[i];
          this.convertedArray = {
            originalResults: round.results.map((a) => ({
              url: a.url ?? '',
              info: convertStoreFileToFileInfo(a),
            })),
            conversions: [],
          };
        }
        this.updateGUI();
      }
    }
  }

  private updateGUI() {
    this.cd.markForCheck();

    if (this.operation) {
      this.oldOperation = {
        id: this.operation.id,
        numOfResults: this.operation.rounds.length,
      };
      this.generationRunning = false;
    }
    this.cd.detectChanges();
  }
}
