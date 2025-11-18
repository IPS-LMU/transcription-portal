import { HttpClient } from '@angular/common/http';
import { SubscriptionManager, wait } from '@octra/utilities';
import { FileInfo } from '@octra/web-media';
import { Observable, Subject, Subscription } from 'rxjs';
import * as X2JS from 'x2js';
import { AppSettings } from '../../../shared/app.settings';
import { getHashString } from '../../preprocessing/preprocessing.functions';
import { StoreFile, StoreItemTask, StoreItemTaskOptions, TaskStatus } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import {
  addProcessingRound,
  convertStoreOperationToIDBOperation,
  getLastOperationResultFromLatestRound,
  getLastOperationRound,
} from '../operation.functions';
import { OperationFactory } from './operation-factory';
import { ASROperation } from './asr-operation-factory';
import { IDBOperation } from '../../../indexedDB';

export interface G2pMausOperationOptions {
  language?: string;
}

export type G2pMausOperation = StoreTaskOperation<G2pMausOperationOptions, G2pMausOperation>;

export class G2pMausOperationFactory extends OperationFactory<G2pMausOperation, G2pMausOperationOptions> {
  protected readonly _description =
    'The transcript text is time-aligned with the signal, i. e. for every word in the text we get ' +
    'the appropriate fragment of the audio signal. MAUS generates such a word alignment from the transcript and the audio file.';
  protected readonly _name = 'MAUS';
  protected readonly _resultType = 'BAS Partitur Format';
  protected readonly _shortTitle = 'WA';
  protected readonly _title = 'Word alignment';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): G2pMausOperation {
    return {
      enabled: true,
      id,
      name: this.name,
      serviceProviderName: 'BAS',
      options: {},
      rounds,
      taskID,
    };
  }

  override applyTaskOptions(options: StoreItemTaskOptions, operation: G2pMausOperation) {
    return {
      ...operation,
      options: {
        language: options.maus?.language === undefined ? operation.options?.language : options.maus?.language,
      },
    };
  }

  override run(
    storeItemTask: StoreItemTask,
    operation: G2pMausOperation,
    httpClient: HttpClient,
    subscrManager: SubscriptionManager<Subscription>,
  ): Observable<{ operation: G2pMausOperation }> {
    const subj = new Subject<{
      operation: G2pMausOperation;
    }>();

    (async () => {
      if (operation.serviceProviderName) {
        const uploadOperationLatestRound = getLastOperationRound(storeItemTask.operations[0]);
        const asrLastOperationResult = getLastOperationResultFromLatestRound(storeItemTask.operations[1]);
        const opIndex = storeItemTask.operations.findIndex((a) => a.name === operation.name);
        const previousOperation = storeItemTask.operations[opIndex - 1];
        const previousOperationLastResult = getLastOperationResultFromLatestRound(previousOperation);
        let clonedOperation: G2pMausOperation = { ...operation };
        let currentRound = getLastOperationRound(clonedOperation);
        if (!currentRound) {
          clonedOperation = addProcessingRound(clonedOperation);
        }

        currentRound = getLastOperationRound(clonedOperation)!;
        currentRound = {
          ...currentRound,
          status: TaskStatus.PROCESSING,
          time: {
            start: Date.now(),
          },
        };
        await wait(0);
        subj.next({
          operation: clonedOperation,
        });

        const serviceProvider = AppSettings.getServiceInformation('BAS')!;
        let url = this.commands[0]
          .replace('{{host}}', serviceProvider.host)
          .replace('{{language}}', clonedOperation.options.language ?? '')
          .replace('{{audioURL}}', uploadOperationLatestRound?.results?.find((a) => a.type.includes('audio'))?.url ?? '');

        // use G2P -> MAUS Pipe
        if (previousOperation?.enabled && previousOperationLastResult?.url) {
          url = url.replace('{{transcriptURL}}', previousOperationLastResult?.url);
        } else {
          if (asrLastOperationResult?.url) {
            url = url.replace('{{transcriptURL}}', asrLastOperationResult?.url);
          }
        }

        const { result, warnings } = await this.processWithG2PCHUNKERMAUS(url, storeItemTask, clonedOperation, httpClient);
        currentRound = {
          ...currentRound,
          results: [...currentRound.results, result],
          status: TaskStatus.FINISHED,
          protocol: warnings,
        };

        return {
          operation: clonedOperation,
          currentRound,
        };
      } else {
        throw new Error('serviceProvider is undefined');
      }
    })()
      .then(({ operation, currentRound }: { operation: G2pMausOperation; currentRound: StoreTaskOperationProcessingRound }) => {
        this.sendOperationWithUpdatedRound(subj, operation, currentRound);
      })
      .catch((err) => {
        subj.error(err);
      });

    return subj;
  }

  private async processWithG2PCHUNKERMAUS(
    url: string,
    task: StoreItemTask,
    clonedOperation: G2pMausOperation,
    httpClient: HttpClient,
  ): Promise<{
    result: StoreFile;
    warnings?: string;
  }> {
    return new Promise<{
      result: StoreFile;
      warnings?: string;
    }>((resolve, reject) => {
      const audioFile = task.files.find((a) => a.type.includes('audio'))!;

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
          next: (g2pResult: string) => {
            let warnings: string | undefined;
            // convert result to json
            const x2js = new X2JS();
            let json: any = x2js.xml2js(g2pResult);
            json = json.WebServiceResponseLink;

            // add messages to protocol
            if (json.warnings !== '') {
              warnings = json.warnings.replace('¶', '');
            } else if (json.output !== '') {
              warnings = json.output.replace('¶', '');
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
                        result: {
                          name: file.fullname,
                          type: file.type,
                          size: file.size,
                          url: file.url,
                          content,
                          blob: undefined,
                          hash,
                          attributes: file.attributes,
                        },
                        warnings,
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

  override async convertOperationToIDBOperation(operation:G2pMausOperation):Promise<IDBOperation> {
    const result = await convertStoreOperationToIDBOperation(operation);
    result.language = operation.options.language;

    return result;
  }
}
