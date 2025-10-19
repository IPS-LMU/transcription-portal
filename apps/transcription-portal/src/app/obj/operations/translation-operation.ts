import { HttpClient } from '@angular/common/http';
import { convertFromSupportedConverters, ImportResult, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { last, wait } from '@octra/utilities';
import { AudioInfo, FileInfo, readFileContents } from '@octra/web-media';
import { AppInfo } from '../../app.info';
import { AppSettings } from '../../shared/app.settings';
import { convertISO639Language } from '../functions';
import { Task, TaskStatus } from '../tasks';
import { IOperation, Operation, OperationOptions } from './operation';

export interface ITranslationOperation extends IOperation {
  language?: string;
}

export class TranslationOperation extends Operation {
  public resultType = 'Text';
  protected _language?: string;
  get language(): string | undefined {
    return this._language;
  }

  set language(value: string | undefined) {
    this._language = value;
  }

  public start = async (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient, accessCode?: string) => {
    this.updateProtocol('');
    this.changeState(TaskStatus.PROCESSING);
    await wait(2);
    this._time.start = Date.now();

    let lastResult: FileInfo | undefined;
    const audioinfo = operations[0].task!.files[0] as AudioInfo;

    if (operations[3].enabled) {
      lastResult = last(operations[3].results);
    } else if (operations[2].enabled) {
      lastResult = last(operations[2].results);
    } else if (operations[1].enabled) {
      lastResult = last(operations[1].results);
    }

    try {
      if (lastResult?.file) {
        let content = await readFileContents<string>(lastResult.file, 'text', 'utf-8');

        const audiofile = new OAudiofile();
        audiofile.duration = audioinfo.duration.samples;
        audiofile.name = audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
        audiofile.sampleRate = audioinfo.sampleRate;
        audiofile.size = audioinfo.size;

        if (lastResult.extension !== '.txt') {
          const importResult: ImportResult | undefined = convertFromSupportedConverters(
            AppInfo.converters.map((a) => a.obj),
            {
              name: lastResult.fullname,
              content,
              type: lastResult.type,
              encoding: 'utf-8',
            },
            audiofile,
          );

          if (!importResult || !importResult.annotjson) {
            const error = "Can't convert last result from a previous operation.";
            this.updateProtocol(this.protocol + '<br/>' + error);
            this.time.duration = Date.now() - this.time.start;
            this.changeState(TaskStatus.ERROR);
            console.error(error);
            return;
          } else {
            const textExport = new TextConverter().export(importResult.annotjson, audiofile, 0);

            if (textExport?.file && !textExport.error) {
              content = textExport.file.content;
            } else {
              const error = "Can't convert last result from a previous operation to a text file.";
              this.updateProtocol(this.protocol + '<br/>' + error);
              this.time.duration = Date.now() - this.time.start;
              this.changeState(TaskStatus.ERROR);
              console.error(error);
              return;
            }
          }
        }

        const result = await this.getTranslation(httpclient, content);
        console.log('TRANSLATION RESULT');
        console.log(result);
        this.time.duration = Date.now() - this.time.start;
        this.results.push(
          new FileInfo(
            lastResult.name + '.txt',
            'text/plain',
            lastResult.size,
            new File([result.translatedText], lastResult.name + '.txt', {
              type: 'text/plain',
            }),
          ),
        );
        this.changeState(TaskStatus.FINISHED);
      }
    } catch (e: any) {
      this.throwError(new Error(e?.error?.message ?? e?.message));
      console.error(e);
    }
  };

  public clone(task?: Task): TranslationOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new TranslationOperation(
      this.name,
      this._commands,
      this.title,
      this.shortTitle,
      selectedTask,
      this.state,
      undefined,
      this.serviceProvider,
      this.language,
    );
  }

  public fromAny(operationObj: ITranslationOperation, commands: string[], task: Task): Operation {
    const result = new TranslationOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider),
      operationObj.language,
    );

    for (const resultObj of operationObj.results) {
      const resultClass = FileInfo.fromAny(resultObj);
      resultClass.attributes = resultObj.attributes;
      result.results.push(resultClass);
    }

    result._time = operationObj.time;
    result.updateProtocol(operationObj.protocol.replace('¶', ''));
    result.enabled = operationObj.enabled;

    return result;
  }

  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    state?: TaskStatus,
    id?: number,
    serviceProvider?: ServiceProvider,
    language?: string,
  ) {
    super(name, commands, title, shortTitle, task, state, id, serviceProvider);
    this._language = language;
    this._description = 'Translates a given annotation to a target language as full text.';
  }

  private async getTranslation(httpClient: HttpClient, text: string) {
    return new Promise<any>((resolve, reject) => {
      let source = 'en';
      if (this.task?.operations && this.language) {
        if (this.task?.operations[3].enabled) {
          // Summarization operation
          source = 'en';
        } else {
          // ASR operation
          source = convertISO639Language(this.language);
        }
      }

      this.subscrManager.add(
        httpClient
          .post(
            'https://translate.cls.ru.nl/translate',
            {
              q: text,
              source,
              target: this.language,
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

  override overwriteOptions(options: OperationOptions) {
    this._serviceProvider = AppSettings.getServiceInformation('Translation');
    this._language = options.translation?.language;
  }

  override async toAny(): Promise<ITranslationOperation> {
    return {
      id: this.id,
      name: this.name,
      state: this.state,
      protocol: this.protocol,
      time: this.time,
      enabled: this.enabled,
      results: await this.serializeResults(),
      serviceProvider: this.serviceProvider?.provider,
      language: this.language,
    };
  }
}
