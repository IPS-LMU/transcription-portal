import { HttpClient } from '@angular/common/http';
import { FileInfo } from '@octra/web-media';
import { Observable, Subject } from 'rxjs';
import * as X2JS from 'x2js';
import { TaskStatus } from '../../../obj/tasks';
import { AppSettings } from '../../../shared/app.settings';
import { getHashString } from '../../preprocessing/preprocessing.functions';
import { StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { OperationFactory } from './operation-factory';

export interface G2pMausOperationOptions {
  language?: string;
}

export class G2pMausOperation extends StoreTaskOperation<G2pMausOperationOptions, G2pMausOperation> {
  override clone(): G2pMausOperation {
    return new G2pMausOperation(this);
  }

  override duplicate(partial?: Partial<StoreTaskOperation<any, G2pMausOperation>>): G2pMausOperation {
    return new G2pMausOperation(partial);
  }
}

export class G2pMausOperationFactory extends OperationFactory<G2pMausOperation, G2pMausOperationOptions> {
  protected readonly _description =
    'The transcript text is time-aligned with the signal, i. e. for every word in the text we get ' +
    'the appropriate fragment of the audio signal. MAUS generates such a word alignment from the transcript and the audio file.';
  protected readonly _name = 'MAUS';
  protected readonly _resultType = 'BAS Partitur Format';
  protected readonly _shortTitle = 'WA';
  protected readonly _title = 'Word alignment';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): G2pMausOperation {
    return new G2pMausOperation({
      enabled: true,
      id,
      name: this.name,
      serviceProviderName: 'BAS',
      options: {},
      rounds,
      taskID,
    });
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: G2pMausOperation) {
    return operation.duplicate({
      ...operation,
      options: {
        language: options.maus?.language === undefined ? operation.options?.language : options.maus?.language,
      },
    });
  }

  override run(storeItemTask: StoreItemTask, operation: G2pMausOperation, httpClient: HttpClient): Observable<{ operation: G2pMausOperation }> {
    const subj = new Subject<{
      operation: G2pMausOperation;
    }>();

    if (operation.serviceProviderName) {
      const clonedOperation = operation.clone();
      let currentRound = clonedOperation.lastRound;
      if (!currentRound || currentRound?.lastResult) {
        clonedOperation.addProcessingRound();
      }
      currentRound = clonedOperation.lastRound!;
      currentRound.status = TaskStatus.PROCESSING;
      currentRound.time = {
        start: Date.now(),
      };
      subj.next({
        operation: clonedOperation,
      });

      const serviceProvider = AppSettings.getServiceInformation('BAS')!;
      let url = this.commands[0]
        .replace('{{host}}', serviceProvider.host)
        .replace('{{language}}', clonedOperation.options.language!)
        .replace('{{audioURL}}', storeItemTask.operations[0].lastRound?.results?.find((a) => a.type.includes('audio'))?.url ?? '');
      const opIndex = storeItemTask.operations.findIndex((a) => a.name === operation.name);
      const previousOperation = storeItemTask.operations[opIndex - 1];

      // use G2P -> MAUS Pipe
      if (previousOperation?.enabled && previousOperation?.lastRound?.lastResult?.url) {
        url = url.replace('{{transcriptURL}}', previousOperation?.lastRound?.lastResult?.url);
      } else {
        if (storeItemTask.operations[1].lastRound?.lastResult?.url) {
          url = url.replace('{{transcriptURL}}', storeItemTask.operations[1].lastRound?.lastResult?.url);
        }
      }

      this.processWithG2PCHUNKERMAUS(url, storeItemTask, clonedOperation, httpClient)
        .then((file) => {
          currentRound.results.push(file);
          currentRound.status = TaskStatus.FINISHED;
          subj.next({ operation: clonedOperation });
        })
        .catch((err) => {
          subj.error(err);
        });
    } else {
      subj.error(new Error('serviceProvider is undefined'));
    }

    return subj;
  }

  private async processWithG2PCHUNKERMAUS(
    url: string,
    task: StoreItemTask,
    clonedOperation: G2pMausOperation,
    httpClient: HttpClient,
  ): Promise<StoreFile> {
    return new Promise<StoreFile>((resolve, reject) => {
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
            const currentRound = clonedOperation.lastRound!;
            currentRound.time!.duration = Date.now() - currentRound.time!.start;

            // convert result to json
            const x2js = new X2JS();
            let json: any = x2js.xml2js(result);
            json = json.WebServiceResponseLink;

            // add messages to protocol
            if (json.warnings !== '') {
              currentRound.protocol += json.warnings.replace('¶', '');
            } else if (json.output !== '') {
              currentRound.protocol += json.output.replace('¶', '');
            }

            if (json.success === 'true') {
              const file = FileInfo.fromURL(json.downloadLink, 'text/plain', undefined, Date.now());
              file
                .updateContentFromURL(httpClient)
                .then((content) => {
                  const name = (task.files[0].attributes?.originalFileName ?? task.files[0].name).replace(/\.[^.]+$/g, '');

                  file.attributes = {
                    originalFileName: `${name}${file.extension}`,
                  };

                  getHashString(file.file!)
                    .then((hash: string) => {
                      resolve({
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        content,
                        blob: undefined,
                        hash,
                        attributes: { originalFileName: file.name },
                      });
                    })
                    .catch((err) => {
                      reject(err);
                    });
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
}
