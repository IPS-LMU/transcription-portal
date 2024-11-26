import { HttpClient } from '@angular/common/http';
import { ServiceProvider } from '@octra/ngx-components';
import { extractFileNameFromURL } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import * as X2JS from 'x2js';
import { AppSettings } from '../../shared/app.settings';
import { ProviderLanguage } from '../oh-config';
import { Task, TaskState } from '../tasks';
import { Operation } from './operation';

export class G2pMausOperation extends Operation {
  // TODO change for the next version
  public resultType = 'TextGrid/json';

  public start = (
    asrService: ServiceProvider,
    languageObject: ProviderLanguage,
    inputs: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode: string
  ) => {
    this.updateProtocol('');
    this.changeState(TaskState.PROCESSING);
    this._time.start = Date.now();

    let url = this._commands[0]
      .replace('{{host}}', asrService.host)
      .replace('{{language}}', this.task?.language!)
      .replace('{{audioURL}}', operations[0]!.results[0]!.url!);

    // use G2P -> MAUS Pipe
    if (
      this.previousOperation?.enabled &&
      this.previousOperation?.lastResult?.url
    ) {
      url = url.replace(
        '{{transcriptURL}}',
        this.previousOperation?.lastResult?.url
      );
    } else {
      if (operations[1].lastResult?.url) {
        url = url.replace('{{transcriptURL}}', operations[1].lastResult?.url);
      }
    }

    httpclient
      .post(
        url,
        {},
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          responseType: 'text',
        }
      )
      .subscribe(
        (result: string) => {
          this.time.duration = Date.now() - this.time.start;

          // convert result to json
          const x2js = new X2JS();
          let json: any = x2js.xml2js(result);
          json = json.WebServiceResponseLink;

          // add messages to protocol
          if (json.warnings !== '') {
            this.updateProtocol(json.warnings.replace('¶'));
          } else if (json.output !== '') {
            this.updateProtocol(json.output.replace('¶'));
          }

          if (json.success === 'true') {
            const { extension } = extractFileNameFromURL(json.downloadLink);
            console.log('g2p');
            console.log(inputs);
            console.log(inputs[0].name + extension);
            const file = FileInfo.fromURL(
              json.downloadLink,
              'text/plain',
              undefined,
              Date.now()
            );
            console.log('file1');
            console.log(file);
            file
              .updateContentFromURL(httpclient)
              .then(() => {
                const name = (
                  inputs[0].attributes?.originalFileName ?? inputs[0].fullname
                ).replace(/\.[^.]+$/g, '');

                file.attributes = {
                  originalFileName: `${name}${file.extension}`,
                };

                this.results.push(file);
                this.changeState(TaskState.FINISHED);

                console.log('file2');
                console.log(file);
              })
              .catch((error: any) => {
                this.updateProtocol(error);
                this.changeState(TaskState.ERROR);
              });
          } else {
            this.changeState(TaskState.ERROR);
          }
        },
        (error) => {
          this.updateProtocol(error.message);
          this.changeState(TaskState.ERROR);
        }
      );
  };

  public clone(task?: Task): G2pMausOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new G2pMausOperation(
      this.name,
      this._commands,
      this.title,
      this.shortTitle,
      selectedTask,
      this.state
    );
  }

  public fromAny(
    operationObj: any,
    commands: string[],
    task: Task
  ): G2pMausOperation {
    const result = new G2pMausOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id
    );
    for (const resultElement of operationObj.results) {
      const resultClass = FileInfo.fromAny(resultElement);
      resultClass.url = resultElement.url;
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result.updateProtocol(operationObj.protocol);
    result.enabled = operationObj.enabled;

    return result;
  }

  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    state?: TaskState,
    id?: number
  ) {
    super(name, commands, title, shortTitle, task, state, id);
    this._description =
      'The transcript text is time-aligned with the signal, i. e. for every word in the text we get ' +
      'the appropriate fragment of the audio signal. MAUS generates such a word alignment from the transcript and the audio file.';
    this._providerInformation = AppSettings.getServiceInformation('BAS');
  }

  onMouseEnter(): void {}

  onMouseLeave(): void {}

  onMouseOver(): void {}
}
