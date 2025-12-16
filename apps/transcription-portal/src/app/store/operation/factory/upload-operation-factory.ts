import { HttpClient, HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { SubscriptionManager, wait } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Observable, Subject, Subscription, throwError } from 'rxjs';
import * as X2JS from 'x2js';
import { environment } from '../../../../environments/environment';
import { TPortalFileInfo } from '../../../obj/TPortalFileInfoAttributes';
import { AppSettings } from '../../../shared/app.settings';
import { StoreFile, StoreItemTask, StoreItemTaskOptions, TaskStatus } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { addProcessingRound, convertStoreOperationToIDBOperation, getLastOperationRound } from '../operation.functions';
import { OperationFactory } from './operation-factory';
import { IDBOperation } from '../../../indexedDB';
import { ASROperation } from './asr-operation-factory';

export type UploadOperation = StoreTaskOperation<any, UploadOperation>;

export class UploadOperationFactory extends OperationFactory<UploadOperation> {
  protected readonly _description =
    'Drag and drop your audio and optional text files on the web page to upload them to the server ' +
    'for processing. Prior to upload, the format of the audio files will be checked; stereo files will be split into ' +
    'their left and right channel.';
  protected readonly _name = 'Upload';
  protected readonly _resultType = '.wav';
  protected readonly _shortTitle = 'UL';
  protected readonly _title = 'Upload';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[], options: any = {}): UploadOperation {
    return {
      enabled: true,
      id,
      name: this.name,
      serviceProviderName: 'BAS',
      options,
      rounds,
      taskID,
    };
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: UploadOperation) {
    // no options to apply
    return operation;
  }

  override run(
    task: StoreItemTask,
    operation: UploadOperation,
    httpClient: HttpClient,
    subscrManager: SubscriptionManager<Subscription>,
  ): Observable<{ operation: StoreTaskOperation }> {
    let clonedOperation = { ...operation };

    if (clonedOperation.serviceProviderName) {
      const subj = new Subject<{ operation: StoreTaskOperation }>();

      wait(0).then(() => {
        try {
          if (!getLastOperationRound(clonedOperation)) {
            clonedOperation = addProcessingRound(clonedOperation);
          }

          let currentRound: StoreTaskOperationProcessingRound = {
            ...getLastOperationRound(clonedOperation)!,
          };
          currentRound.protocol = '';
          currentRound.status = TaskStatus.UPLOADING;
          this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);

          currentRound = {
            ...currentRound,
            time: {
              start: Date.now(),
            },
          };

          UploadOperationFactory.upload(task.files, httpClient).subscribe({
            next: async (obj) => {
              if (obj.type === 'progress') {
                currentRound = { ...currentRound, progress: obj.progress };
                currentRound = this.updateEstimatedEnd(currentRound);

                this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);
              } else if (obj.type === 'loadend') {
                currentRound = {
                  ...currentRound,
                  time: {
                    ...currentRound.time!,
                    duration: Date.now() - currentRound.time!.start,
                  },
                  protocol: obj.warnings ? currentRound.protocol + obj.warnings + '<br/>' : currentRound.protocol,
                };

                if (obj.urls && obj.urls.length === task.files.length) {
                  for (let i = 0; i < task.files.length; i++) {
                    const file = { ...task.files[i] };
                    // TODO change file url in task
                    file.url = obj.urls[i];
                    const { extension } = FileInfo.extractFileName(file.name);
                    const type = extension.indexOf('wav') > 0 ? 'audio/wav' : 'text/plain';
                    const info = TPortalFileInfo.fromURL(file.url, type, file.name, Date.now());
                    let content: string | undefined;

                    if (type === 'text/plain') {
                      content = await info.updateContentFromURL(httpClient);
                    }

                    const existingIndex = currentRound.results.findIndex((a) => a.attributes?.originalFileName === info.attributes?.originalFileName);
                    if (existingIndex > -1) {
                      currentRound = {
                        ...currentRound,
                        results: [
                          ...currentRound.results.slice(0, existingIndex),
                          {
                            ...file,
                            name: file.name,
                            attributes: file.attributes,
                            url: info.url,
                            online: true,
                            content,
                            blob: undefined,
                          },
                          ...currentRound.results.slice(existingIndex + 1),
                        ],
                      };
                    } else {
                      // append result
                      currentRound = {
                        ...currentRound,
                        results: [
                          ...currentRound.results,
                          {
                            ...file,
                            name: file.name,
                            attributes: file.attributes,
                            url: info.url,
                            online: true,
                            content,
                            blob: undefined,
                          },
                        ],
                      };
                    }
                  }
                  currentRound.status = TaskStatus.FINISHED;

                  this.sendOperationWithUpdatedRound(subj, clonedOperation, currentRound);
                  subj.complete();
                } else {
                  subj.error(new Error('Number of returned URLs do not match number of files.'));
                }
              }
            },
            error: (err) => {
              subj.error(new Error(err?.error?.message ?? err?.message));
            },
          });
        } catch (e) {
          subj.error(e);
        }
      });

      return subj;
    } else {
      return throwError(() => new Error(clonedOperation.protocol + '\n' + 'serviceProvider is undefined'));
    }
  }

  public static upload(
    files: StoreFile[],
    httpClient: HttpClient,
  ): Subject<{
    type: 'progress' | 'loadend';
    progress?: number;
    urls?: string[];
    warnings?: string;
  }> {
    const url = AppSettings.configuration.api.commands[0].calls[0].replace('{{host}}', AppSettings.getServiceInformation('BAS')!.host);
    const subj = new Subject<{
      type: 'progress' | 'loadend';
      progress?: number;
      urls?: string[];
      warnings?: string;
    }>();

    const form: FormData = new FormData();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.blob) {
        form.append('file' + i, files[i]!.blob!);
      } else if (file.content) {
        form.append('file' + i, new File([file.content], file.name, { type: file.type }));
      }
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

  public updateEstimatedEnd = (round: StoreTaskOperationProcessingRound) => {
    if (round.progress && round.time) {
      const timeTillNow = Date.now() - round.time.start;
      const timeOnePercent = timeTillNow / round.progress;
      const time = Math.round((1 - round.progress) * timeOnePercent);
      round.estimatedEnd = Date.now() + time;
    } else {
      round.estimatedEnd = 0;
    }
    return round;
  };

  override async convertOperationToIDBOperation(operation:UploadOperation):Promise<IDBOperation> {
    return await convertStoreOperationToIDBOperation(operation);
  }
}
