import { HttpClient } from '@angular/common/http';
import { ServiceProvider } from '@octra/ngx-components';
import { FileInfo } from '@octra/web-media';
import * as X2JS from 'x2js';
import { AppSettings } from '../../shared/app.settings';
import { Task, TaskStatus } from '../tasks';
import { IOperation, Operation, OperationOptions, OperationProcessingRound } from './operation';
import { UploadOperation } from './upload-operation';

export interface IG2PMausOperation extends IOperation {
  language?: string;
}

export class G2pMausOperation extends Operation {
  // TODO change for the next version
  public resultType = 'TextGrid/json';
  protected _language?: string;
  get language(): string | undefined {
    return this._language;
  }

  set language(value: string | undefined) {
    this._language = value;
  }

  public start = async (inputs: FileInfo[], operations: Operation[], httpclient: HttpClient, accessCode?: string) => {
    if (this.serviceProvider) {
      this.updateProtocol('');
      this.changeState(TaskStatus.PROCESSING);
      this.time = {
        start: Date.now(),
      };

      const serviceProvider = AppSettings.getServiceInformation('BAS')!;
      let url = this._commands[0]
        .replace('{{host}}', serviceProvider.host)
        .replace('{{language}}', this.language!)
        .replace('{{audioURL}}', (operations[0] as UploadOperation).wavFile!.url!);

      // use G2P -> MAUS Pipe
      if (this.previousOperation?.enabled && this.previousOperation?.lastRound?.lastResult?.url) {
        url = url.replace('{{transcriptURL}}', this.previousOperation?.lastRound?.lastResult?.url);
      } else {
        if (operations[1].lastRound?.lastResult?.url) {
          url = url.replace('{{transcriptURL}}', operations[1].lastRound?.lastResult?.url);
        }
      }

      try {
        const currentRound = this.lastRound!;
        const file = await this.processWithG2PCHUNKERMAUS(url, inputs, httpclient);
        currentRound.results.push(file);
        this.changeState(TaskStatus.FINISHED);
      } catch (e: any) {
        this.throwError(e);
      }
    } else {
      this.throwError(new Error('serviceProvider is undefined'));
    }
  };

  public clone(task?: Task): G2pMausOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new G2pMausOperation(this.name, this._commands, this.title, this.shortTitle, selectedTask, undefined, this.serviceProvider, this.language);
  }

  public fromAny(operationObj: IG2PMausOperation, commands: string[], task: Task): G2pMausOperation {
    const result = new G2pMausOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.id,
      AppSettings.getServiceInformation(operationObj.serviceProvider),
      operationObj.language,
    );

    for (const round of operationObj.rounds) {
      result.rounds.push(OperationProcessingRound.fromAny(round));
    }
    result.enabled = operationObj.enabled;

    return result;
  }

  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    id?: number,
    serviceProvider?: ServiceProvider,
    language?: string,
  ) {
    super(name, commands, title, shortTitle, task, id, serviceProvider);
    this._language = language;
    this._description =
      'The transcript text is time-aligned with the signal, i. e. for every word in the text we get ' +
      'the appropriate fragment of the audio signal. MAUS generates such a word alignment from the transcript and the audio file.';
  }

  private async processWithG2PCHUNKERMAUS(url: string, inputs: FileInfo[], httpClient: HttpClient): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      httpClient
        .post(
          url,
          {},
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
            responseType: 'text',
          },
        )
        .subscribe({
          next: (result: string) => {
            this.time!.duration = Date.now() - this.time!.start;

            // convert result to json
            const x2js = new X2JS();
            let json: any = x2js.xml2js(result);
            json = json.WebServiceResponseLink;

            // add messages to protocol
            if (json.warnings !== '') {
              this.updateProtocol(json.warnings.replace('¶', ''));
            } else if (json.output !== '') {
              this.updateProtocol(json.output.replace('¶', ''));
            }

            if (json.success === 'true') {
              const file = FileInfo.fromURL(json.downloadLink, 'text/plain', undefined, Date.now());
              file
                .updateContentFromURL(httpClient)
                .then(() => {
                  const name = (inputs[0].attributes?.originalFileName ?? inputs[0].fullname).replace(/\.[^.]+$/g, '');

                  file.attributes = {
                    originalFileName: `${name}${file.extension}`,
                  };

                  resolve(file);
                })
                .catch((error: any) => reject(error));
            } else {
              reject(new Error(json.output));
            }
          },
          error: (error) => {
            reject(new Error(error.message));
          },
        });
    });
  }

  override overwriteOptions(options: OperationOptions) {
    this._serviceProvider = AppSettings.getServiceInformation('BAS');
    this._language = options.maus?.language;
  }

  override async toAny(): Promise<IG2PMausOperation> {
    return {
      id: this.id,
      name: this.name,
      enabled: this.enabled,
      rounds: await this.serializeProcessingRounds(),
      serviceProvider: this.serviceProvider?.provider,
      language: this._language,
    };
  }
}
