import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ServiceProvider } from '@octra/ngx-components';
import { FileInfo } from '@octra/web-media';
import { Observable, Subject } from 'rxjs';
import * as X2JS from 'x2js';
import { environment } from '../../../environments/environment';
import { AppSettings } from '../../shared/app.settings';
import { TimePipe } from '../../shared/time.pipe';
import { Task, TaskStatus } from '../tasks';
import { IOperation, Operation, OperationOptions } from './operation';

export type IUploadOperation = IOperation;

export class UploadOperation extends Operation {
  public constructor(
    name: string,
    commands: string[],
    title?: string,
    shortTitle?: string,
    task?: Task,
    state?: TaskStatus,
    id?: number,
    serviceProvider?: ServiceProvider,
  ) {
    super(name, commands, title, shortTitle, task, state, id, serviceProvider);
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
    httpClient: HttpClient,
  ): Subject<{
    type: 'progress' | 'loadend';
    progress?: number;
    urls?: string[];
    warnings?: string;
  }> {
    const subj = new Subject<{
      type: 'progress' | 'loadend';
      progress?: number;
      urls?: string[];
      warnings?: string;
    }>();

    const form: FormData = new FormData();

    for (let i = 0; i < files.length; i++) {
      form.append('file' + i, files[i]!.file!);
    }

    const headers: any = {};

    if (environment.production) {
      headers['ngsw-bypass'] = 'true';
    }

    (
      httpClient.post(url, form, {
        reportProgress: true,
        observe: 'events' as any,
        headers,
        responseType: 'text',
      }) as any as Observable<HttpEvent<ArrayBuffer>>
    ).subscribe({
      next: (event: HttpEvent<any>) => {
        if (event.type === HttpEventType.UploadProgress) {
          let progress = -1;
          if (event.total) {
            progress = event.loaded / event.total;
          }
          subj.next({
            type: 'progress',
            progress,
          });
        } else if (event.type === HttpEventType.Response) {
          const result = event.body as string;
          const x2js = new X2JS();
          let json: any = x2js.xml2js(result);
          json = json.UploadFileMultiResponse;
          let warnings: string | undefined;

          if (json.warnings !== '') {
            warnings = json.warnings.replace('¶', '');
          }

          if (json.success) {
            const urls = Array.isArray(json.fileList.entry) ? json.fileList.entry.map((a: any) => a.value) : [json.fileList.entry.value];

            subj.next({
              type: 'loadend',
              warnings,
              urls,
            });
            subj.complete();
          } else {
            subj.error(new Error(json.message));
          }
        }
      },
      error: (err: HttpErrorResponse) => {
        subj.error(err);
      },
    });

    return subj;
  }

  public start = async (files: FileInfo[], operations: Operation[], httpclient: HttpClient, accessCode?: string) => {
    if (this.serviceProvider) {
      this._results = [];
      this.updateProtocol('');
      this.changeState(TaskStatus.UPLOADING);
      this._time.start = Date.now();

      const url = this._commands[0].replace('{{host}}', AppSettings.getServiceInformation('BAS')!.host);

      this.subscrManager.add(
        UploadOperation.upload(files, url, httpclient).subscribe({
          next: (obj) => {
            if (obj.type === 'progress') {
              this.progress = obj.progress!;
              this.updateEstimatedEnd();
              this.changed.next();
            } else if (obj.type === 'loadend') {
              this.time.duration = Date.now() - this.time.start;

              // add messages to protocol
              if (obj.warnings) {
                this.updateProtocol(obj.warnings);
              }

              if (obj.urls && obj.urls.length === files.length) {
                for (let i = 0; i < files.length; i++) {
                  files[i].url = obj.urls[i];
                  const type = files[i].extension.indexOf('wav') > 0 ? 'audio/wav' : 'text/plain';
                  const info = FileInfo.fromURL(files[i]!.url!, type, files[i]!.fullname, Date.now());
                  info.attributes = files[i].attributes;
                  this.results.push(info);
                }
                this.changeState(TaskStatus.FINISHED);
              } else {
                this.throwError(new Error('Number of returned URLs do not match number of files.'));
              }
            }
          },
          error: (err) => {
            this.throwError(new Error(err?.error?.message ?? err?.message));
          },
        }),
      );
    } else {
      this.throwError(new Error(this.protocol + '\n' + 'serviceProvider is undefined'));
    }
  };

  public override getStateIcon = (sanitizer: DomSanitizer): SafeHtml => {
    let result = '';
    switch (this._state) {
      case TaskStatus.PENDING:
        result = '';
        break;
      case TaskStatus.UPLOADING:
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
      case TaskStatus.PROCESSING:
        result = '<i class="bi bi-gear spin"></i>\n' + '<span class="sr-only">Loading...</span>';
        break;
      case TaskStatus.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskStatus.READY:
        result = '<a href="#"><i class="bi bi-pencil-square" aria-hidden="true"></i></a>';
        break;
      case TaskStatus.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return sanitizer.bypassSecurityTrustHtml(result);
  };

  public override getStateIcon2 = (state: TaskStatus): string => {
    let result = '';

    switch (state) {
      case TaskStatus.PENDING:
        result = '';
        break;
      case TaskStatus.UPLOADING:
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
      case TaskStatus.PROCESSING:
        result = '<i class="bi bi-gear-fill spin"></i>\n' + '<span class="sr-only">Processing...</span>';
        break;
      case TaskStatus.FINISHED:
        result = '<i class="bi bi-check-lg" aria-hidden="true"></i>';
        break;
      case TaskStatus.READY:
        result = `<div class="spinner-border spinner-border-small" role="status">
  <span class="visually-hidden">Loading...</span>
</div>`;
        break;
      case TaskStatus.ERROR:
        result = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
        break;
    }

    return result;
  };

  public clone(task?: Task): UploadOperation {
    const selectedTask = task === null || task === undefined ? this.task : task;
    return new UploadOperation(this.name, this._commands, this.title, this.shortTitle, selectedTask, this.state, undefined, this.serviceProvider);
  }

  public fromAny(operationObj: IUploadOperation, commands: string[], task: Task): UploadOperation {
    const result = new UploadOperation(
      operationObj.name,
      commands,
      this.title,
      this.shortTitle,
      task,
      operationObj.state,
      operationObj.id,
      AppSettings.getServiceInformation('BAS'),
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

  override overwriteOptions(options: OperationOptions) {
    this._serviceProvider = AppSettings.getServiceInformation('BAS')!;
  }

  override async toAny(): Promise<IUploadOperation> {
    return {
      id: this.id,
      name: this.name,
      state: this.state,
      protocol: this.protocol,
      time: this.time,
      enabled: this.enabled,
      results: await this.serializeResults(),
      serviceProvider: this.serviceProvider?.provider,
    };
  }
}
