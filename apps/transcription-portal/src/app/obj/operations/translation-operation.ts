import { HttpClient } from '@angular/common/http';
import { ImportResult, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { last } from '@octra/utilities';
import { AudioInfo, FileInfo, readFileContents } from '@octra/web-media';
import { AppInfo } from '../../app.info';
import { AppSettings } from '../../shared/app.settings';
import { ProviderLanguage } from '../oh-config';
import { Task, TaskStatus } from '../tasks';
import { Operation } from './operation';

export class TranslationOperation extends Operation {
  public webService = '';
  public resultType = 'Text';

  private sumProjectName = '';

  public start = (
    asrService: ServiceProvider,
    languageObject: ProviderLanguage,
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode: string,
  ) => {
    this.webService = asrService.provider!;
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
          let importResult: ImportResult | undefined;
          const iFile = {
            name: lastResult.fullname,
            content,
            type: lastResult.type,
            encoding: 'utf-8',
          };

          for (const converter of AppInfo.converters) {
            importResult = converter.obj.import(iFile, audiofile);

            if (importResult.annotjson && !importResult.error) {
              break;
            }
          }

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

        const result = await this.getTranslation(
          httpclient,
          content,
          languageObject,
        );
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
    );
  }

  public fromAny(operationObj: any, commands: string[], task: Task): Operation {
    const result = new TranslationOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id,
    );
    for (const resultObj of operationObj.results) {
      const resultClass = FileInfo.fromAny(resultObj);
      resultClass.attributes = resultObj.attributes;
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result.updateProtocol(operationObj.protocol.replace('¶'));
    result.enabled = operationObj.enabled;
    result.webService = operationObj.webService.replace('ASR', '');

    if (
      !(
        operationObj.serviceProvider === null ||
        operationObj.serviceProvider === undefined
      )
    ) {
      result._providerInformation = AppSettings.getServiceInformation(
        operationObj.serviceProvider,
      );
      console.log(`loaded ASR: ${result._providerInformation?.provider}`);
    } else {
      const providerName = operationObj.webService.replace('ASR', '');

      if (providerName !== '') {
        result._providerInformation =
          AppSettings.getServiceInformation(providerName);
        console.log(
          `provider not available, set ${result._providerInformation?.provider}`,
        );
      }
    }

    return result;
  }

  override toAny(): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      const result = {
        id: this.id,
        name: this.name,
        state: this.state,
        protocol: this.protocol,
        time: this.time,
        enabled: this.enabled,
        webService: this.webService,
        serviceProvider: !(
          this._providerInformation === null ||
          this._providerInformation === undefined
        )
          ? this._providerInformation.provider
          : undefined,
        results: [],
      };

      // result data
      const promises: Promise<any>[] = [];
      for (const resultObj of this.results) {
        promises.push(resultObj.toAny());
      }

      if (promises.length > 0) {
        Promise.all(promises)
          .then((values) => {
            result.results = values as never[];
            resolve(result);
          })
          .catch((error) => {
            reject(error);
          });
      } else {
        resolve(result);
      }
    });
  }

  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    state?: TaskStatus,
    id?: number,
  ) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description =
      'Translates a given annotation to a target language as full text.';
  }

  onMouseEnter(): void {}

  onMouseLeave(): void {}

  onMouseOver(): void {}

  private async getTranslation(
    httpClient: HttpClient,
    text: string,
    languageObject: ProviderLanguage,
  ) {
    return new Promise<any>((resolve, reject) => {
      let source = 'en';
      if (this.task?.operations) {
        if (this.task?.operations[3].enabled) {
          // Summarization operation
          source = 'nl';
        } else {
          // ASR operation
          source = languageObject.value
            .replace(/([a-z]+)-([A-Z]+).*/g, '$2')
            .toLowerCase();
        }
      }

      this.subscrManager.add(
        httpClient
          .post(
            'https://translate.cls.ru.nl/translate',
            {
              q: text,
              source,
              target: 'en',
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
