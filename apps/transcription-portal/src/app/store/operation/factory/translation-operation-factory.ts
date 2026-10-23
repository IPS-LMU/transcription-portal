import { HttpClient } from '@angular/common/http';
import {
  convertFromSupportedConverters,
  ImportResult,
  OAnnotJSON,
  OSegment,
  SRTConverter,
  SRTConverterExportOptions,
  SRTConverterImportOptions,
} from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { joinURL, SubscriptionManager, wait } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Observable, retry, Subject, Subscription } from 'rxjs';
import { AppInfo } from '../../../app.info';
import { IDBOperation } from '../../../indexedDB';
import { convertISO639Language } from '../../../obj/functions';
import { AppSettings } from '../../../shared/app.settings';
import { StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions, TaskStatus } from '../../store-item';
import { getLatestResultFromPreviousEnabledOperation } from '../../store-item/store-item.functions';
import { OperationSubscriptionManager, StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { addProcessingRound, convertStoreOperationToIDBOperation, getLastOperationRound } from '../operation.functions';
import { ASROperation } from './asr-operation-factory';
import { OperationFactory } from './operation-factory';

export interface TranslationOperationOptions {
  language?: string;
}

export type TranslationOperation = StoreTaskOperation<TranslationOperationOptions, TranslationOperation>;

export class TranslationOperationFactory extends OperationFactory<TranslationOperation, TranslationOperationOptions> {
  protected readonly _description = 'Translates a given full text.';
  protected readonly _name = 'Translation';
  protected readonly _resultType = 'Text';
  protected readonly _shortTitle = 'TR';
  protected readonly _title = 'Translation';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): TranslationOperation {
    return {
      enabled: true,
      id,
      name: this.name,
      options: {},
      serviceProviderName: 'LibreTranslate',
      rounds,
      taskID,
    };
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: TranslationOperation): TranslationOperation {
    return {
      ...operation,
      options: {
        language: options.translation?.language === undefined ? operation.options?.language : options.translation?.language,
      },
    };
  }

  override run(
    storeItemTask: StoreItemTask,
    operation: TranslationOperation,
    httpClient: HttpClient,
    subscrManager: OperationSubscriptionManager,
    item$: Observable<StoreItemTask | undefined>,
  ): Observable<{ operation: StoreTaskOperation }> {
    const octraOperation = storeItemTask.operations.find((a) => a.name === 'OCTRA')!;
    const subj = new Subject<{ operation: TranslationOperation }>();

    subscrManager.addSubscription(
      item$.subscribe({
        next: (item: StoreItemTask | undefined) => {
          if (item?.disabled || item?.stopRequested) {
            subscrManager.destroy();
          }
        },
      }),
    );

    wait(0).then(() => {
      let clonedOperation = { ...operation };
      if (!getLastOperationRound(clonedOperation)) {
        clonedOperation = addProcessingRound(clonedOperation);
      }
      let currentRound = getLastOperationRound(clonedOperation)!;
      currentRound = {
        ...currentRound,
        status: TaskStatus.PROCESSING,
        time: {
          start: Date.now(),
        },
      };
      this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);

      let lastResult: StoreFile | undefined = getLatestResultFromPreviousEnabledOperation(storeItemTask, operation);
      const audioinfo = storeItemTask?.files?.find((a) => a.type.includes('audio')) as StoreAudioFile;

      if (!lastResult) {
        const transcriptFromInputs = storeItemTask?.files.find((a) => !a.type.includes('audio'));
        if (transcriptFromInputs) {
          lastResult = transcriptFromInputs;
        }
      }

      try {
        if (lastResult?.content && audioinfo) {
          let content = lastResult.content;
          let transcripts: {
            level: number;
            sampleStart: number;
            value: string;
          }[] = [];
          const audiofile = new OAudiofile();
          audiofile.duration = audioinfo.duration;
          audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.name;
          audiofile.sampleRate = audioinfo.sampleRate;
          audiofile.size = audioinfo.size;

          const { extension } = FileInfo.extractFileName(lastResult.name);
          let newAnnotJSON: OAnnotJSON | undefined = undefined;

          if (extension !== '.srt') {
            let importResult: ImportResult | undefined = convertFromSupportedConverters(
              AppInfo.converters.map((a) => a.obj),
              {
                name: lastResult.name,
                content,
                type: lastResult.type,
                encoding: 'utf-8',
              },
              audiofile,
            );

            if (!importResult || !importResult.annotjson) {
              console.error(importResult?.error);
              subj.error(new Error("Can't convert last result from a previous operation."));
              return;
            } else {
              const needsOptions = new SRTConverter().needsOptionsForExport(importResult.annotjson, audiofile);
              const srtOptions = new SRTConverter().getDefaultOptions<SRTConverterExportOptions>(needsOptions);
              const anno = OAnnotJSON.deserialize(importResult.annotjson)!;
              const textExport = new SRTConverter().export(anno, audiofile, srtOptions);
              let combineSegmentsWithSameSpeakerThreshold: number | undefined = undefined;

              if (
                storeItemTask.files.length > 1 &&
                storeItemTask.files.some((a) => !a.type.includes('audio') && !a.name.includes('.srt')) &&
                !octraOperation?.enabled
              ) {
                // audio file + any transcript but SRT provided => ASR disabled
                combineSegmentsWithSameSpeakerThreshold = 1000;
              } else if (storeItemTask.files.length === 1 && !octraOperation?.enabled) {
                // ASR enabled but OCTRA disabled
                combineSegmentsWithSameSpeakerThreshold = 1000;
              }

              if (textExport?.file && !textExport.error) {
                importResult = new SRTConverter().import(
                  textExport.file,
                  audiofile,
                  importResult.annotjson.levels.length > 1 &&
                    importResult.annotjson.levels.some(
                      (a) =>
                        a.name.includes('SPEAKER_') ||
                        a.items.some((b) => b.labels.some((c) => new RegExp('\\[([^\\]]+)\\]\\s*:\\s*').exec(c.value) !== null)),
                    )
                    ? ({
                        speakerIdentifierPattern: '\\[([^\\]]+)\\]\\s*:\\s*',
                        sortSpeakerSegments: true,
                        combineSegmentsWithSameSpeakerThreshold,
                      } as SRTConverterImportOptions)
                    : {
                        sortSpeakerSegments: false,
                      },
                );
                if (importResult.annotjson) {
                  newAnnotJSON = importResult.annotjson;
                } else {
                  console.error(importResult?.error);
                  subj.error(new Error("Can't import converted last result from a previous operation to a SRT file."));
                  return;
                }
              } else {
                subj.error(new Error("Can't convert last result from a previous operation to a SRT file."));
                return;
              }
            }
          } else {
            const importResult = new SRTConverter().import(
              {
                name: lastResult.name,
                content,
                type: lastResult.type,
                encoding: 'utf-8',
              },
              audiofile,
              {
                sortSpeakerSegments: false,
              },
            );

            if (!importResult || !importResult.annotjson) {
              console.error(importResult?.error);
              subj.error(new Error("Can't convert last result from a previous operation."));
              return;
            }

            newAnnotJSON = importResult?.annotjson;
          }

          // prepare transcripts for translation
          transcripts = [];
          for (let i = 0; i < (newAnnotJSON?.levels ?? []).length; i++) {
            const tempElem = newAnnotJSON!.levels[i];

            transcripts.push(
              ...tempElem.items
                .map((a: any) => ({
                  level: i,
                  sampleStart: (a as OSegment).sampleStart,
                  value: a.getFirstLabelWithoutName('Speaker')!.value!,
                }))
                .filter((a: any) => a.value && a.value !== ''),
            );
          }

          transcripts.sort((a, b) => a.sampleStart - b.sampleStart);

          this.getTranslation(httpClient, transcripts, storeItemTask, clonedOperation, subscrManager)
            .then((result) => {
              const translations: any[] = result.translatedText;
              const { name } = FileInfo.extractFileName(lastResult.name);
              const annotJSON = OAnnotJSON.deserialize(newAnnotJSON!.serialize())!;
              const needsOptions = new SRTConverter().needsOptionsForExport(annotJSON, audiofile);
              const srtOptions = new SRTConverter().getDefaultOptions<SRTConverterExportOptions>(needsOptions);

              for (let i = 0; i < translations.length; i++) {
                const translation = translations[i];
                const original = transcripts[i];
                const levelIndex = original.level;
                const level = annotJSON.levels[levelIndex];
                const index = level?.items?.findIndex((a: any) => a.sampleStart === original.sampleStart);

                if (level && index > -1) {
                  (level.items[index] as OSegment).replaceFirstLabelWithoutName('Speaker', (value) => translation);
                } else {
                  subj.error(new Error(`Translation mapping error. Can\`t find item with sample start ${translation.sampleStart}));`));
                  return;
                }
              }

              currentRound = {
                ...currentRound,
                results: [
                  {
                    name: name + '.srt',
                    type: 'text/plain',
                    size: lastResult.size,
                    blob: undefined,
                    content: new SRTConverter().export(annotJSON, audiofile, srtOptions).file?.content,
                    attributes: {
                      originalFileName: name + '.srt',
                    },
                    hash: '',
                  },
                ],
                time: {
                  start: currentRound.time!.start,
                  duration: Date.now() - currentRound.time!.start,
                },
                status: TaskStatus.FINISHED,
              };
              this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);
              subj.complete();
            })
            .catch((e) => {
              subj.error(new Error(e?.error?.error?.description ?? e?.error?.message ?? e?.message));
            });
        } else {
          subj.error(new Error("Can't find transcript for translation"));
        }
      } catch (e: any) {
        subj.error(new Error(e?.error?.error?.description ?? e?.error?.message ?? e?.message));
      }
    });

    return subj;
  }

  private async getTranslation(
    httpClient: HttpClient,
    transcripts: {
      level: number;
      sampleStart: number;
      value: string;
    }[],
    storeItemTask: StoreItemTask,
    operation: StoreTaskOperation,
    subscrManager: OperationSubscriptionManager,
  ) {
    return new Promise<any>((resolve, reject) => {
      let source: string | undefined = 'en';
      if (storeItemTask?.operations && operation.options.language) {
        if ((storeItemTask.operations[1] as ASROperation).options.language) {
          // ASR operation
          source = convertISO639Language((storeItemTask.operations[1] as ASROperation).options.language!);
        } else {
          source = 'en';
        }
      }
      const serviceProvider = AppSettings.getServiceInformation(operation.serviceProviderName);

      if (!serviceProvider) {
        reject(new Error("Can't find service information."));
        return;
      }

      subscrManager.addSubscription(
        httpClient
          .post(
            joinURL(serviceProvider.host, '/translate'),
            {
              q: transcripts.map((a) => a.value),
              source,
              target: operation.options.language,
              format: 'text',
              alternatives: 0,
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
          .pipe(retry({ count: 3, delay: 2000 }))
          .subscribe({
            next: resolve,
            error: reject,
          }),
      );
    });
  }

  override async convertOperationToIDBOperation(operation: TranslationOperation): Promise<IDBOperation> {
    const result = await convertStoreOperationToIDBOperation(operation);
    result.language = operation.options.language;

    return result;
  }
}
