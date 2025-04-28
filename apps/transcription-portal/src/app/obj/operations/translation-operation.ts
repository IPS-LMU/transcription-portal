import { HttpClient } from '@angular/common/http';
import { ServiceProvider } from '@octra/ngx-components';
import { last } from '@octra/utilities';
import { FileInfo, readFileContents } from '@octra/web-media';
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
      const lastResult = last(operations[3].results);
      console.log('LAST RESULT FROM SUMMARIZATION OPERATION');
      console.log(lastResult);

      if (lastResult?.file) {
        const content = await readFileContents<string>(
          lastResult.file,
          'text',
          'utf-8',
        );
        const result = await this.getTranslation(httpclient, content);
        console.log('TRANSLATION RESULT');
        console.log(result);
        this.time.duration = Date.now() - this.time.start;
        this.results.push(
          new FileInfo(
            lastResult.fullname,
            lastResult.type,
            lastResult.size,
            new File([result.translatedText], lastResult.fullname, {
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
      'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  onMouseEnter(): void {}

  onMouseLeave(): void {}

  onMouseOver(): void {}

  private async getTranslation(httpClient: HttpClient, text: string) {
    return new Promise<any>((resolve, reject) => {
      this.subscrManager.add(
        httpClient
          .post(
            'https://translate.cls.ru.nl/translate',
            {
              q: text,
              source: 'nl',
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
