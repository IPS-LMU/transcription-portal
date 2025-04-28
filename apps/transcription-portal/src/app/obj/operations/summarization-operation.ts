import { HttpClient } from '@angular/common/http';
import { PartiturConverter, TextConverter } from '@octra/annotation';
import { OAudiofile } from '@octra/media';
import { ServiceProvider } from '@octra/ngx-components';
import { last, stringifyQueryParams, wait } from '@octra/utilities';
import {
  AudioInfo,
  downloadFile,
  FileInfo,
  readFileContents,
} from '@octra/web-media';
import { interval } from 'rxjs';
import { AppSettings } from '../../shared/app.settings';
import { ProviderLanguage } from '../oh-config';
import { Task, TaskStatus } from '../tasks';
import { Operation } from './operation';

export class SummarizationOperation extends Operation {
  public webService = '';
  public resultType = 'Text';

  public start = (
    asrService: ServiceProvider,
    languageObject: ProviderLanguage,
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode: string,
  ) => {
    this.webService = asrService.provider!;

    setTimeout(async () => {
      this.updateProtocol('');
      this.changeState(TaskStatus.PROCESSING);
      this._time.start = Date.now();

      console.log('RUN SUMMARIZATION WITH ASR RESULTS');
      console.log(operations[2].results);
      console.log('UPLOAD RESULTS');
      console.log(operations[0].results);

      const transcriptFile = operations[2].enabled
        ? last(operations[2].results)
        : last(operations[1].results);
      const audioinfo = operations[0].task!.files[0] as AudioInfo;

      if (transcriptFile?.file && audioinfo) {
        let transcript = '';
        const content = await readFileContents<string>(
          transcriptFile.file,
          'text',
          'utf-8',
        );

        const audiofile = new OAudiofile();
        audiofile.duration = audioinfo.duration.samples;
        audiofile.name =
          audioinfo.attributes?.originalFileName ?? audioinfo.fullname;
        audiofile.sampleRate = audioinfo.sampleRate;
        audiofile.size = audioinfo.size;

        if (transcriptFile.extension === '.txt') {
          transcript = content;
        } else {
          const converter = new PartiturConverter();
          const imported = converter.import(
            {
              name: transcriptFile.fullname,
              type: transcriptFile.type,
              content,
              encoding: 'utf-8',
            },
            audiofile,
          );
          transcript = new TextConverter().export(
            imported.annotjson!,
            audiofile,
            0,
          ).file!.content;
        }

        console.log('TRANSCRIPT');
        console.log(transcript);

        const projectName = await this.createSummarizationProject(httpclient);
        console.log(`Created project ${projectName}`);
        await this.uploadFile(
          new File([transcript], `${projectName}.txt`, {
            type: 'text/plain',
          }),
          httpclient,
          projectName,
        );
        console.log('uploaded file to project successfully');

        console.log('Start processing...');
        await wait(3);
        const res = await this.processSummarizationProject(
          httpclient,
          projectName,
        );
        console.log(res);
        this.subscrManager.add(
          interval(5000).subscribe({
            next: async () => {
              const result = await this.getProjectStatus(
                httpclient,
                projectName,
              );
              console.log('Retrieve project status...');
              console.log(result);

              if (
                result.status === 'success' &&
                result.body.status === 'finished'
              ) {
                if (result.body.errors) {
                  this.time.duration = Date.now() - this.time.start;

                  const summary = result.body.outputs.find((o: any) =>
                    o.filename.includes('error'),
                  );

                  if (summary) {
                    const file = new File([transcript], `${projectName}.txt`, {
                      type: 'text/plain',
                    });
                    this.results.push(
                      new FileInfo(file.name, file.type, file.size, file),
                    );
                    console.log('ADD TO RESULTS:');
                    console.log(this.results);
                    this.changeState(TaskStatus.FINISHED);
                  }
                } else {
                  this.changeState(TaskStatus.ERROR);
                  this.updateProtocol(result.body.errorMessage);

                  const errorLogFileURL: string = result.body.outputs.find(
                    (o: any) => o.filename === 'error.log',
                  )?.url;
                  if (errorLogFileURL) {
                    const errorLog = await downloadFile(
                      errorLogFileURL,
                      'text',
                    );
                    console.error('SUMMARIZATION ERROR:\n\n' + errorLog);
                  }
                }

                this.subscrManager.removeByTag('status check');
                console.log("Remove project");
                await this.deleteSummarizationProject(httpclient, projectName);
              }
            },
          }),
          'status check',
        );
        console.log('processing finished');
      } else {
        this.changeState(TaskStatus.ERROR);
        this.updateProtocol('Missing transcript file or audio file.');
      }
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
    state?: TaskStatus,
    id?: number,
  ) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description =
      'Speech Recognition will attempt to extract the verbatim content of an audio recording.' +
      'The result of this process is a text file with a literal transcription of the audio file. \n' +
      'NOTE: audio files may be processed by commercial providers who may store and keep the data you send them!';
  }

  async createSummarizationProject(httpClient: HttpClient) {
    return new Promise<string>((resolve, reject) => {
      const projectName = `tportal_session_${Date.now()}`;
      this.subscrManager.add(
        httpClient
          .post(
            'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project/create',
            {
              projectName,
            },
            { responseType: 'json' },
          )
          .subscribe({
            next: () => {
              resolve(projectName);
            },
            error: reject,
          }),
      );
    });
  }

  async processSummarizationProject(
    httpclient: HttpClient,
    projectName: string,
  ) {
    return new Promise<void>((resolve, reject) => {
      this.subscrManager.add(
        httpclient
          .post(
            'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project/process',
            {
              projectName,
              language: 'nl',
              gpu: false,
            },
            { responseType: 'json' },
          )
          .subscribe({
            next: () => resolve(),
            error: reject,
          }),
      );
    });
  }

  getProjectStatus(httpclient: HttpClient, projectName: string) {
    return new Promise<any>((resolve, reject) => {
      this.subscrManager.add(
        httpclient
          .get(
            `https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project${stringifyQueryParams(
              {
                projectName,
              },
            )}`,
            { responseType: 'json' },
          )
          .subscribe({
            next: resolve,
            error: reject,
          }),
      );
    });
  }

  deleteSummarizationProject(httpclient: HttpClient, projectName: string) {
    return new Promise<void>((resolve, reject) => {
      this.subscrManager.add(
        httpclient
          .delete(
            'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project',
            {
              responseType: 'json',
              body: {
                projectName,
              },
            },
          )
          .subscribe({
            next: () => resolve(),
            error: reject,
          }),
      );
    });
  }

  uploadFile(file: File, httpClient: HttpClient, projectName: string) {
    return new Promise<void>((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectName', projectName);
      this.subscrManager.add(
        httpClient
          .post(
            'https://clarin.phonetik.uni-muenchen.de/apps/TranscriptionPortal-Dev/api/summarization/project/upload',
            formData,
          )
          .subscribe({
            next: () => resolve(),
            error: reject,
          }),
      );
    });
  }

  onMouseEnter(): void {}

  onMouseLeave(): void {}

  onMouseOver(): void {}
}
