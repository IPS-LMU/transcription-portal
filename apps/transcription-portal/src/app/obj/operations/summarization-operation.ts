import { HttpClient } from '@angular/common/http';
import { ServiceProvider } from '@octra/ngx-components';
import { stringifyQueryParams } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { AppSettings } from '../../shared/app.settings';
import { ProviderLanguage } from '../oh-config';
import { Task, TaskState } from '../tasks';
import { Operation } from './operation';

export class SummarizationOperation extends Operation {
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
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();

    setTimeout(async () => {
      await this.createSummarizationProject(httpclient);
    }, 2000);
  };

  public clone(task?: Task): SummarizationOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new SummarizationOperation(
      this.name,
      this._commands,
      this.title,
      this.shortTitle,
      selectedTask,
      this.state,
    );
  }

  public fromAny(operationObj: any, commands: string[], task: Task): Operation {
    const result = new SummarizationOperation(
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
    state?: TaskState,
    id?: number,
  ) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description =
      'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  async createSummarizationProject(httpClient: HttpClient) {
    return new Promise<any>((resolve, reject) => {
      this.sumProjectName = `tportal_session_${Date.now()}`;
      this.subscrManager.add(
        httpClient
          .post(
            'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project/create',
            {
              projectName: this.sumProjectName,
            },
            { responseType: 'json' },
          )
          .subscribe({
            next: resolve,
            error: reject,
          }),
      );
    });
  }

  processSummarizationProject(httpclient: HttpClient) {
    this.subscrManager.add(
      httpclient
        .post(
          'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project/process',
          {
            projectName: this.sumProjectName,
            language: 'nl',
            gpu: false,
          },
          { responseType: 'json' },
        )
        .subscribe({
          next: (result) => {
            console.log('SUMM PROCESS PROJECT RESULT:');
            console.log(result);
          },
        }),
    );
  }

  getProjectStatus(httpclient: HttpClient) {
    this.subscrManager.add(
      httpclient
        .get(
          `https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project${stringifyQueryParams(
            {
              projectName: this.sumProjectName,
            },
          )}`,
          { responseType: 'json' },
        )
        .subscribe({
          next: (result) => {
            console.log('SUMM GET STATUS PROJECT RESULT:');
            console.log(result);
          },
        }),
    );
  }

  deleteSummarizationProject(httpclient: HttpClient) {
    this.subscrManager.add(
      httpclient
        .delete(
          'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project',
          {
            responseType: 'json',
            body: {
              projectName: this.sumProjectName,
            },
          },
        )
        .subscribe({
          next: (result) => {
            console.log('SUMM DELETE PROJECT RESULT:');
            console.log(result);
          },
        }),
    );
  }

  uploadFile(file: File, httpClient: HttpClient) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectName', this.sumProjectName);
    this.subscrManager.add(
      httpClient
        .post(
          'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project/upload',
          formData,
        )
        .subscribe({
          next: (result) => {
            console.log('SUMM UPLOAD FILE PROJECT RESULT:');
            console.log(result);
          },
        }),
    );
  }

  onMouseEnter(): void {}

  onMouseLeave(): void {}

  onMouseOver(): void {}
}
