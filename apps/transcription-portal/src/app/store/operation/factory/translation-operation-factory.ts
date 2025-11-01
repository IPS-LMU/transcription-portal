import { HttpClient } from '@angular/common/http';
import { convertFromSupportedConverters, ImportResult, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { SubscriptionManager, wait } from '@octra/utilities';
import { FileInfo, readFileContents } from '@octra/web-media';
import { Observable, Subject, Subscription } from 'rxjs';
import { AppInfo } from '../../../app.info';
import { IDBOperation } from '../../../indexedDB';
import { convertISO639Language } from '../../../obj/functions';
import { StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions, TaskStatus } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import {
  addProcessingRound,
  convertStoreOperationToIDBOperation,
  getLastOperationResultFromLatestRound,
  getLastOperationRound,
} from '../operation.functions';
import { ASROperation } from './asr-operation-factory';
import { OperationFactory } from './operation-factory';

export interface TranslationOperationOptions {
  language?: string;
}

export type TranslationOperation = StoreTaskOperation<TranslationOperationOptions, TranslationOperation>;

export class TranslationOperationFactory extends OperationFactory<TranslationOperation, TranslationOperationOptions> {
  protected readonly _description = 'Summarizes a given full text.';
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
    subscrManager: SubscriptionManager<Subscription>,
  ): Observable<{ operation: StoreTaskOperation }> {
    const subj = new Subject<{ operation: TranslationOperation }>();

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

      let lastResult: StoreFile | undefined;
      const audioinfo = storeItemTask?.files?.find((a) => a.type.includes('audio')) as StoreAudioFile;

      if (storeItemTask.operations[3].enabled) {
        lastResult = getLastOperationResultFromLatestRound(storeItemTask.operations[3]);
      } else if (storeItemTask.operations[2].enabled) {
        lastResult = getLastOperationResultFromLatestRound(storeItemTask.operations[2]);
      } else if (storeItemTask.operations[1].enabled) {
        lastResult = getLastOperationResultFromLatestRound(storeItemTask.operations[1]);
      } else {
        const transcriptFromInputs = storeItemTask?.files.find((a) => !a.type.includes('audio'));
        if (transcriptFromInputs) {
          lastResult = transcriptFromInputs;
        }
      }

      try {
        if (lastResult?.content && audioinfo) {
          let content = lastResult.content;
          const audiofile = new OAudiofile();
          audiofile.duration = audioinfo.duration;
          audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.name;
          audiofile.sampleRate = audioinfo.sampleRate;
          audiofile.size = audioinfo.size;

          const { extension } = FileInfo.extractFileName(lastResult.name);
          if (extension !== '.txt') {
            const importResult: ImportResult | undefined = convertFromSupportedConverters(
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
              subj.error(new Error("Can't convert last result from a previous operation."));
              return;
            } else {
              const textExport = new TextConverter().export(importResult.annotjson, audiofile, 0);

              if (textExport?.file && !textExport.error) {
                content = textExport.file.content;
              } else {
                subj.error(new Error("Can't convert last result from a previous operation to a text file."));
                return;
              }
            }
          }

          this.getTranslation(httpClient, content, storeItemTask, clonedOperation, subscrManager)
            .then((result) => {
              const { name } = FileInfo.extractFileName(lastResult.name);
              currentRound = {
                ...currentRound,
                results: [
                  {
                    name: name + '.txt',
                    type: 'text/plain',
                    size: lastResult.size,
                    blob: undefined,
                    content: result.translatedText,
                    attributes: {
                      originalFileName: name + '.txt',
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
            .catch((err) => {
              subj.error(err);
            });
        } else {
          subj.error(new Error('Can#t find transcript for translation'));
        }
      } catch (e: any) {
        subj.error(new Error(e?.error?.message ?? e?.message));
      }
    });

    return subj;
  }

  private async getTranslation(
    httpClient: HttpClient,
    text: string,
    storeItemTask: StoreItemTask,
    operation: StoreTaskOperation,
    subscrManager: SubscriptionManager<Subscription>,
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

      subscrManager.add(
        httpClient
          .post(
            'https://translate.cls.ru.nl/translate',
            {
              q: text,
              source,
              target: operation.options.language,
              format: 'text',
              alternatives: 1,
              api_key: '',
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
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
