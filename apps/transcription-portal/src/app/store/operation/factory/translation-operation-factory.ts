import { HttpClient } from '@angular/common/http';
import { convertFromSupportedConverters, ImportResult, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { FileInfo, readFileContents } from '@octra/web-media';
import { Observable, Subject } from 'rxjs';
import { AppInfo } from '../../../app.info';
import { convertISO639Language } from '../../../obj/functions';
import { TaskStatus } from '../../../obj/tasks';
import { StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { ASROperation } from './asr-operation-factory';
import { OperationFactory } from './operation-factory';

export interface TranslationOperationOptions {
  language?: string;
}

export class TranslationOperation extends StoreTaskOperation<TranslationOperationOptions, TranslationOperation> {
  override clone(): TranslationOperation {
    return new TranslationOperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, TranslationOperation>>): TranslationOperation {
    return new TranslationOperation(partial);
  }
}

export class TranslationOperationFactory extends OperationFactory<TranslationOperation, TranslationOperationOptions> {
  protected readonly _description = 'Summarizes a given full text.';
  protected readonly _name = 'Translation';
  protected readonly _resultType = 'Text';
  protected readonly _shortTitle = 'TR';
  protected readonly _title = 'Translation';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): TranslationOperation {
    return new TranslationOperation({
      enabled: true,
      id,
      name: this.name,
      options: {},
      serviceProviderName: 'LibreTranslate',
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: TranslationOperation): TranslationOperation {
    return operation.duplicate({
      ...operation,
      options: {
        language: options.translation?.language === undefined ? operation.options?.language : options.translation?.language,
      },
    });
  }

  override run(storeItemTask: StoreItemTask, operation: TranslationOperation, httpClient: HttpClient): Observable<{ operation: StoreTaskOperation }> {
    const subj = new Subject<{ operation: TranslationOperation }>();
    const clonedOperation = operation.clone();
    if (!clonedOperation.lastRound || operation.lastRound?.lastResult) {
      clonedOperation.addProcessingRound();
    }
    const currentRound = clonedOperation.lastRound!;
    currentRound.status = TaskStatus.PROCESSING;
    currentRound.time = {
      start: Date.now(),
    };

    let lastResult: StoreFile | undefined;
    const audioinfo = storeItemTask?.files?.find((a) => a.type.includes('audio')) as StoreAudioFile;

    if (storeItemTask.operations[3].enabled) {
      lastResult = storeItemTask.operations[3].lastRound?.lastResult;
    } else if (storeItemTask.operations[2].enabled) {
      lastResult = storeItemTask.operations[2].lastRound?.lastResult;
    } else if (storeItemTask.operations[1].enabled) {
      lastResult = storeItemTask.operations[1].lastRound?.lastResult;
    } else {
      const transcriptFromInputs = storeItemTask?.files.find((a) => !a.type.includes('audio'));
      if (transcriptFromInputs) {
        lastResult = transcriptFromInputs;
      }
    }

    try {
      if (lastResult?.blob && audioinfo) {
        readFileContents<string>(lastResult.blob, 'text', 'utf-8')
          .then((content: string) => {
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

            this.getTranslation(httpClient, content, storeItemTask, clonedOperation)
              .then((result) => {
                currentRound.time!.duration = Date.now() - currentRound.time!.start;
                const { name } = FileInfo.extractFileName(lastResult.name);
                currentRound.results.push({
                  name: name + '.txt',
                  type: 'text/plain',
                  size: lastResult.size,
                  blob: undefined,
                  content: result.translatedText,
                  attributes: {
                    originalFileName: name + '.txt',
                  },
                  hash: '',
                });
                currentRound.status = TaskStatus.FINISHED;
                subj.next({ operation: clonedOperation });
                subj.complete();
              })
              .catch((err) => {
                subj.error(err);
              });
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

    return subj;
  }

  private async getTranslation(httpClient: HttpClient, text: string, storeItemTask: StoreItemTask, operation: StoreTaskOperation) {
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

      this.subscrManager.add(
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
}
