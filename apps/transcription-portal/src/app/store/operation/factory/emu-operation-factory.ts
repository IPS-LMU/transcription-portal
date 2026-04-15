import { HttpClient } from '@angular/common/http';
import { hasProperty, stringifyQueryParams, SubscriptionManager } from '@octra/utilities';
import { Observable, Subscription, throwError } from 'rxjs';
import { IDBOperation } from '../../../indexedDB';
import { EmuWebAppOutMessageEventData, WindowMessageCommandLoad, WindowMessageCommandLoadParams } from '../../../obj/emu-webapp.types';
import { OctraWindowMessageEventData, StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskOptions } from '../../store-item';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { convertStoreOperationToIDBOperation } from '../operation.functions';
import { ToolOperationFactory } from './operation-factory';
import { FileInfo } from '@octra/web-media';

export type EmuOperation = StoreTaskOperation<any, EmuOperation>;
export class EmuOperationFactory extends ToolOperationFactory<EmuOperation> {
  protected readonly _description =
    'The phonetic detail editor presents an interactive audio-visual display of the audio signal and ' +
    'the associated words or phonemes. This is useful for interpreting a transcript, e. g. to determine the focus of' +
    ' a sentence or phrase.';
  protected readonly _name = 'Emu WebApp';
  protected readonly _resultType = 'AnnotJSON';
  protected readonly _shortTitle = 'PD';
  protected readonly _title = 'Phonetic Detail';

  create(id: number, taskID: number, rounds: StoreTaskOperationProcessingRound[]): EmuOperation {
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

  override applyTaskOptions(options: StoreItemTaskOptions, operation: EmuOperation): EmuOperation {
    return operation;
  }

  override run(
    storeItemTask: StoreItemTask,
    operation: EmuOperation,
    httpClient: HttpClient,
    subscrManager: SubscriptionManager<Subscription>,
    item$: Observable<StoreItemTask | undefined>,
  ): Observable<{ operation: StoreTaskOperation }> {
    return throwError(() => new Error('Not implemented'));
  }

  public async getToolURL(audioFile: StoreAudioFile, transcriptFile: StoreFile | undefined, httpClient: HttpClient): Promise<string> {
    const urlParams: {
      listenForMessages: boolean;
    } = {
      listenForMessages: true
    };

    return `${this.commands[0]}${stringifyQueryParams(urlParams)}`;
  }

  override async convertOperationToIDBOperation(operation: EmuOperation): Promise<IDBOperation> {
    return convertStoreOperationToIDBOperation(operation);
  }

  override async parseMessageEvent(
    $event: MessageEvent,
    iframe: HTMLIFrameElement,
    audioFile: StoreAudioFile,
    transcriptFile: StoreFile | undefined,
  ): Promise<OctraWindowMessageEventData | undefined> {
    const data = $event.data as EmuWebAppOutMessageEventData;
    if (data && data.trigger) {
      if (data.trigger === 'manualSave') {
        return {
          status: 'success',
          data: {
            annotation: {
              name: data.data?.annotation?.name + '_annot.json',
              content: JSON.stringify($event.data.data.annotation, null, 2),
              type: 'application/json',
              encoding: 'utf-8',
            },
          },
        };
      } else if (data.trigger === 'listening') {
        await this.updateEmuWebAppOptions(iframe, audioFile, transcriptFile);
        return undefined;
      }
    }
    return undefined;
  }

  private async updateEmuWebAppOptions(iframe: HTMLIFrameElement, audioFile: StoreAudioFile, transcriptFile: StoreFile | undefined) {
    const params: WindowMessageCommandLoadParams = {
      disableBundleListSidebar: true,
      saveToWindowParent: true,
      audioGetUrl: audioFile.url,
      labelGetUrl: transcriptFile?.url,
    };

    if (transcriptFile?.url) {
      const { extension } = FileInfo.extractFileName(transcriptFile!.name);
      params.labelType = extension === '_annot.json' ? 'annotJSON' : 'TEXTGRID';
    }

    if (iframe && iframe.contentWindow) {
      const command: WindowMessageCommandLoad = {
        type: 'command',
        command: 'load',
        params: {
          ...params,
          styles: {
            colorBlack: '#fafffa',
            colorWhite: '#237053',
            colorBlue: '#009eb3',
            colorGrey: '#f3f1f1',
            colorDarkGrey: '#b3d6d3',
            fontSmallSize: '15px',
            fontLargeSize: '18px',
            colorTransparentYellow: 'rgba(255, 255, 22, 0.15)',
            spectrogram: {
              heatMapColorAnchors: [
                [250, 255, 250],
                [61, 189, 140],
                [20, 62, 46],
              ],
            },
          },
        },
      };
      iframe.contentWindow.postMessage(command, '*');
    }
  }
}
