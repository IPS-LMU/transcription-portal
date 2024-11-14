import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { FileInfo } from '@octra/web-media';
import { Subject } from 'rxjs';
import * as X2JS from 'x2js';
import { TimePipe } from '../../shared/time.pipe';
import { OHLanguageObject } from '../oh-config';
import { Task, TaskState } from '../tasks';
import { Operation } from './operation';

export class UploadOperation extends Operation {
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
      'Drag and drop your audio and optional text files on the web page to upload them to the server ' +
      'for processing. Prior to upload, the format of the audio files will be checked; stereo files will be split into ' +
      'their left and right channel.';
  }

  public get wavFile(): FileInfo | undefined {
    return this.results.find((file) => {
      return file.extension.indexOf('wav') > -1 && file.online;
    });
  }

  public resultType = '.wav';

  private progress = 0;

  public static upload(
    files: FileInfo[],
    url: string,
    httpclient: HttpClient
  ): Subject<{
    type: 'progress' | 'loadend';
    result?: any;
  }> {
    const subj = new Subject<{
      type: 'progress' | 'loadend';
      result?: any;
    }>();

    const form: FormData = new FormData();

    for (let i = 0; i < files.length; i++) {
      form.append('file' + i, files[i]!.file!);
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.addEventListener(
      'progress',
      (e: ProgressEvent) => {
        let progress = -1;
        if (e.lengthComputable) {
          progress = e.loaded / e.total;
        }
        subj.next({
          type: 'progress',
          result: progress as any,
        });
      },
      false
    );

    xhr.onerror = (e) => {
      subj.error(e);
    };

    xhr.onloadend = (e) => {
      subj.next({
        type: 'loadend',
        result: (e.currentTarget as any).responseText as any,
      });
      subj.complete();
    };
    xhr.send(form);

    return subj;
  }

  public start = (
    languageObject: OHLanguageObject,
    files: FileInfo[],
    operations: Operation[],
    httpclient: HttpClient,
    accessCode: string
  ) => {
    this._results = [];
    this.updateProtocol('');
    this.changeState(TaskState.UPLOADING);
    this._time.start = Date.now();

    const url = this._commands[0].replace('{{host}}', languageObject.host);
    const subj = UploadOperation.upload(files, url, httpclient);

    subj.subscribe(
      (obj) => {
        if (obj.type === 'progress') {
          this.progress = obj.result as number;
          this.updateEstimatedEnd();
          this.changed.next();
        } else if (obj.type === 'loadend') {
          this.time.duration = Date.now() - this.time.start;
          const result = obj.result as string;
          const x2js = new X2JS();
          let json: any = x2js.xml2js(result);
          json = json.UploadFileMultiResponse;

          // add messages to protocol
          if (json.warnings !== '') {
            this.updateProtocol(json.warnings.replace('¶'));
          }

          if (json.success === 'true') {
            // TODO set urls to results only
            if (Array.isArray(json.fileList.entry)) {
              for (let i = 0; i < files.length; i++) {
                files[i].url = json.fileList.entry[i].value;
                const type =
                  files[i].extension.indexOf('wav') > 0
                    ? 'audio/wav'
                    : 'text/plain';
                this.results.push(
                  FileInfo.fromURL(
                    files[i]!.url!,
                    type,
                    files[i]!.fullname,
                    Date.now()
                  )
                );
              }
            } else {
              // json attribute entry is an object
              files[0].url = json.fileList.entry.value;
              this.results.push(
                FileInfo.fromURL(
                  json.fileList.entry.value,
                  'audio/wav',
                  undefined,
                  Date.now()
                )
              );
            }
            this.changeState(TaskState.FINISHED);
          } else {
            this.updateProtocol(json.message);
            this.changeState(TaskState.ERROR);
          }
        }
      },
      (e) => {
        console.error(e);
        // add messages to protocol
        this.updateProtocol(e.message);
        this.changeState(TaskState.ERROR);
      }
    );
  };

  public override getStateIcon = (sanitizer: DomSanitizer): SafeHtml => {
    let result = '';
    switch (this._state) {
      case TaskState.PENDING:
        result = '';
        break;
      case TaskState.UPLOADING:
        if (this.progress > 0) {
          this.updateEstimatedEnd();
          const time = this.estimatedEnd ? this.estimatedEnd - Date.now() : 0;
          result =
            '<i class="bi bi-cloud-upload" aria-hidden="true" style="color: cornflowerblue"></i> ' +
            '<span>' +
            new TimePipe().transform(time) +
            '</span>';
        } else {
          result = `<div class="spinner-border spinner-border-small" style="height:15px;" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        }
        break;
      case TaskState.PROCESSING:
        result =
          '<i class="bi bi-gear spin"></i>\n' +
          '<span class="sr-only">Loading...</span>';
        break;
      case TaskState.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskState.READY:
        result =
          '<a href="#"><i class="bi bi-pencil-square" aria-hidden="true"></i></a>';
        break;
      case TaskState.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public override getStateIcon2 = (state: TaskState): string => {
    let result = '';

    switch (state) {
      case TaskState.PENDING:
        result = '';
        break;
      case TaskState.UPLOADING:
        if (this.progress > 0) {
          this.updateEstimatedEnd();
          const time = this.estimatedEnd ? this.estimatedEnd - Date.now() : 0;
          result =
            '<i class="bi bi-cloud-upload" aria-hidden="true" style="color: cornflowerblue"></i> ' +
            '<span>' +
            new TimePipe().transform(time) +
            '</span>';
        } else {
          result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading... ${this.progress}</span>
</div>`;
        }
        break;
      case TaskState.PROCESSING:
        result =
          '<i class="bi bi-gear-fill spin"></i>\n' +
          '<span class="sr-only">Processing...</span>';
        break;
      case TaskState.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskState.READY:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskState.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public clone(task?: Task): UploadOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new UploadOperation(
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
  ): UploadOperation {
    const result = new UploadOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id
    );
    for (const resultObj of operationObj.results) {
      const resultClass = new FileInfo(
        resultObj.fullname,
        resultObj.type,
        resultObj.size
      );
      resultClass.url = resultObj.url;
      result.results.push(resultClass);
    }
    result._time = operationObj.time;
    result.updateProtocol(operationObj.protocol);
    result.enabled = operationObj.enabled;
    return result;
  }

  public updateEstimatedEnd = () => {
    if (this.progress > 0) {
      const timeTillNow = Date.now() - this.time.start;
      const timeOnePercent = timeTillNow / this.progress;
      const time = Math.round((1 - this.progress) * timeOnePercent);
      this.estimatedEnd = Date.now() + time;
    } else {
      this.estimatedEnd = 0;
    }
  };
}
