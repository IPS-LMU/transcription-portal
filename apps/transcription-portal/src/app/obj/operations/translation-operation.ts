import { HttpClient } from '@angular/common/http';
import {
  convertFromSupportedConverters,
  ImportResult,
  TextConverter,
} from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { last } from '@octra/utilities';
import { AudioInfo, FileInfo, readFileContents } from '@octra/web-media';
import { AppInfo } from '../../app.info';
import { AppSettings } from '../../shared/app.settings';
import { convertISO639Language } from '../functions';
import { Task, TaskStatus } from '../tasks';
import { IOperation, Operation } from './operation';

export class TranslationOperation extends Operation {
  public resultType = 'Text';

  private sumProjectName = '';

  public start = (
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode?: string,
  ) => {
    this.updateProtocol('');
    this.changeState(TaskStatus.PROCESSING);
    this._time.start = Date.now();

    setTimeout(async () => {
      let lastResult: FileInfo | undefined;
      const audioinfo = operations[0].task!.files[0] as AudioInfo;

      if (operations[3].enabled) {
        lastResult = last(operations[3].results);
      } else if (operations[2].enabled) {
        lastResult = last(operations[2].results);
      } else if (operations[1].enabled) {
        lastResult = last(operations[1].results);
      }

      console.log('LAST RESULT is');
      console.log(lastResult);

      try {
        if (lastResult?.file) {
          let content = await readFileContents<string>(
            lastResult.file,
            'text',
            'utf-8',
          );

          const audiofile = new OAudiofile();
          audiofile.duration = audioinfo.duration.samples;
          audiofile.name =
            audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
          audiofile.sampleRate = audioinfo.sampleRate;
          audiofile.size = audioinfo.size;

          if (lastResult.extension !== '.txt') {
            const importResult: ImportResult | undefined =
              convertFromSupportedConverters(
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
              const error =
                "Can't convert last result from a previous operation.";
              this.updateProtocol(this.protocol + '<br/>' + error);
              this.time.duration = Date.now() - this.time.start;
              this.changeState(TaskStatus.ERROR);
              console.error(error);
              return;
            } else {
              const textExport = new TextConverter().export(
                importResult.annotjson,
                audiofile,
                0,
              );

              if (textExport?.file && !textExport.error) {
                content = textExport.file.content;
              } else {
                const error =
                  "Can't convert last result from a previous operation to a text file.";
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
    }, 2000);
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

  public fromAny(
    operationObj: IOperation,
    commands: string[],
    task: Task,
    taskObj?: any,
  ): Operation {
    const result = new TranslationOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider) ??
        AppSettings.getServiceInformation(taskObj.summariztationProvider),
      operationObj.language ?? taskObj.language,
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
    super(
      name,
      commands,
      title,
      shortTitle,
      task,
      state,
      id,
      serviceProvider,
      language,
    );
    this._description =
      'Translates a given annotation to a target language as full text.';
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
}
