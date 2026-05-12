import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { sum } from '@octra/api-types';
import { NgbModalWrapper, openModal } from '@octra/ngx-components';
import { downloadFile } from '@octra/ngx-utilities';
import { extractFileNameFromURL, SubscriptionManager } from '@octra/utilities';
import { DateTime } from 'luxon';
import { catchError, exhaustMap, forkJoin, map, merge, Observable, of, tap, timer, withLatestFrom } from 'rxjs';
import { UrlModeModalComponent } from '../../modals/url-mode-modal/url-mode-modal.component';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { RoutingService } from '../../routing.service';
import { RootState } from '../app';
import { ModeActions } from '../mode/mode.actions';
import { convertStoreItemToIDBItem } from '../operation/operation.functions';
import { PreprocessingActions } from '../preprocessing/preprocessing.actions';
import { StoreItem } from '../store-item';
import { getAllTasks } from './mode.functions';

@Injectable()
export class ModeEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private subscrManager = new SubscriptionManager();
  private routingService = inject(RoutingService);
  private modalService = inject(NgbModal);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);

  initModes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.initModes.do),
      map(() => {
        return ModeActions.initModes.success();
      }),
    ),
  );

  updateProtocolURLSuccess$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.updateProtocolURL.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) => {
        const affectedMode = state.modes.entities[state.modes.currentMode]!;
        return forkJoin(
          getAllTasks(affectedMode?.items ?? []).map((item: StoreItem) => convertStoreItemToIDBItem(item, affectedMode.defaultOperations)),
        ).pipe(
          exhaustMap((values) => {
            const json = {
              version: '2.0.0',
              encoding: 'UTF-8',
              created: DateTime.now().toISO(),
              mode: state.modes.currentMode,
              entries: values,
            };

            const fileName = `transcription_portal_${action.mode}_${DateTime.now().toISO()}.json`;
            const file = new File([JSON.stringify(json, null, 2)], fileName, {
              type: 'text/plain',
            });

            const url = URL.createObjectURL(file);
            return of(
              ModeActions.updateProtocolURL.success({
                url,
                fileName,
              }),
            );
          }),
          catchError((err) =>
            of(
              ModeActions.updateProtocolURL.fail({
                error: err.message,
              }),
            ),
          ),
        );
      }),
    ),
  );

  defaultOptionsEnabledChanged$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.setDefaultOperationEnabled.do),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        return of(
          ModeActions.setDefaultOperationEnabled.success({
            defaultOptions: state.modes.entities[state.modes.currentMode]!.defaultOperations,
          }),
        );
      }),
    ),
  );

  afterIDBLoadedReadQueryParams$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.changeMode.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]) => {
        if (action.firstChange) {
          const params = this.routingService.staticQueryParams;

          let audioURL: string | undefined;
          let audioLanguage: string | undefined;
          let audioType: string | undefined;
          let transcriptURL: string | undefined;
          let transcriptType: string | undefined;

          if (Object.keys(params).includes('audio') && params.audio) {
            audioURL = decodeURIComponent(params.audio);
          }

          if (Object.keys(params).includes('audio_language') && params.audio_language) {
            audioLanguage = decodeURIComponent(params.audio_language);
          }

          if (Object.keys(params).includes('audio_type') && params.audio_type) {
            audioType = decodeURIComponent(params.audio_type);
          }

          if (Object.keys(params).includes('transcript') && params.transcript) {
            transcriptURL = decodeURIComponent(params.transcript);
          }

          if (Object.keys(params).includes('transcript_type') && params.transcript_type) {
            transcriptType = decodeURIComponent(params.transcript_type);
          }

          this.routingService.removeStaticParam('audio');
          this.routingService.removeStaticParam('audio_language');
          this.routingService.removeStaticParam('audio_type');
          this.routingService.removeStaticParam('transcript');
          this.routingService.removeStaticParam('transcript_type');
          this.routingService.removeStaticParam('mode');

          if (audioURL) {
            return of(
              ModeActions.readFilesFromURL.do({
                audioURL,
                audioType,
                transcriptURL,
                transcriptType,
                audioLanguage,
              }),
            );
          }
        }

        return of();
      }),
    ),
  );

  readFilesFromURL$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ModeActions.readFilesFromURL.do),
        withLatestFrom(this.store),
        tap(
          ([{ audioURL, audioType, audioLanguage, transcriptURL, transcriptType }, state]: [
            {
              audioURL: string | undefined;
              audioType?: string;
              audioLanguage?: string;
              transcriptURL?: string;
              transcriptType?: string;
            },
            any,
          ]) => {
            let errorMessage = '';

            if (audioURL) {
              let leftTime = 0;
              let ref: NgbModalWrapper<UrlModeModalComponent> | undefined;

              const close = () => {
                this.subscrManager.removeByTag('waitForURLImport');
                if (ref) {
                  this.routingService.navigate('remove query params', [], {
                    queryParams: {
                      audio: null,
                      transcript: null,
                    },
                    queryParamsHandling: 'merge',
                  });
                  ref.close();
                }
              };

              this.subscrManager.add(
                timer(2000).subscribe({
                  next: () => {
                    ref = openModal<UrlModeModalComponent>(this.modalService, UrlModeModalComponent, UrlModeModalComponent.options, {
                      leftTime,
                      error: errorMessage,
                    });
                  },
                }),
                'waitForURLImport',
              );

              try {
                const observables: Observable<{
                  progress: number;
                  result?: ArrayBuffer;
                  downloadURL: string;
                }>[] = [];

                const progress: {
                  downloadURL: string;
                  progress: number;
                  result?: ArrayBuffer;
                }[] = [];

                observables.push(
                  downloadFile<ArrayBuffer>(this.http, audioURL, 'arraybuffer').pipe(
                    map((a) => ({
                      ...a,
                      downloadURL: audioURL,
                    })),
                  ),
                );

                if (transcriptURL) {
                  observables.push(
                    downloadFile(this.http, transcriptURL, 'arraybuffer').pipe(
                      map((a) => ({
                        ...a,
                        result: a.result as ArrayBuffer,
                        downloadURL: transcriptURL,
                      })),
                    ),
                  );
                }

                const downloadStartedAt = Date.now();
                merge(...observables).subscribe({
                  next: async (event) => {
                    const index = progress.findIndex((a: any) => a.downloadURL === event.downloadURL);

                    if (index > -1) {
                      progress[index].progress = event.progress;

                      if (event.result) {
                        progress[index].result = event.result;

                        if (progress.filter((a) => a.result !== undefined).length === observables.length) {
                          // retrieving files finished
                          const filename = `from_url_${new Date().toLocaleString().replace(/, /g, '_').replace(/[ .:]/g, '-')}`;
                          const infos: TPortalFileInfo[] = [];

                          for (const progressElement of progress) {
                            let mediaType: string | undefined;

                            if (progressElement.downloadURL.includes('?')) {
                              const matches = /mediatype=([^&]+)/g.exec(progressElement.downloadURL);
                              mediaType = matches ? matches[1] : undefined;
                              progressElement.downloadURL = progressElement.downloadURL.replace(/\?.*/g, '');
                            }

                            const nameFromURL = extractFileNameFromURL(progressElement.downloadURL);

                            let extension = '';
                            if (nameFromURL.extension) {
                              extension = nameFromURL.extension;
                            } else {
                              if (mediaType) {
                                if (mediaType.includes('audio')) {
                                  extension = '.wav';
                                } else if (mediaType.includes('text')) {
                                  extension = '.txt';
                                } else if (mediaType.includes('json')) {
                                  extension = '_annot.json';
                                }
                              }
                            }

                            const info = TPortalFileInfo.fromURL(
                              progressElement.downloadURL,
                              mediaType ?? (extension === '.wav' ? (audioType ?? 'audio/wave') : (transcriptType ?? 'text/plain')),
                              `${filename}${extension}`,
                            ) as TPortalFileInfo;

                            info.file = new File([progressElement.result!], info.fullname, {
                              type: info.type,
                            });
                            info.url = undefined;

                            infos.push(info);
                          }

                          this.subscrManager.add(
                            timer(0).subscribe({
                              next: () => {
                                this.store.dispatch(
                                  PreprocessingActions.addToQueue.do({
                                    infoItems: infos,
                                  }),
                                );
                              },
                            }),
                          );

                          close();
                        }
                      }
                    } else {
                      progress.push({
                        downloadURL: event.downloadURL,
                        progress: event.progress,
                      });
                    }

                    if (ref) {
                      const overallProgress = Math.min(sum(progress.map((a) => a.progress * 100)) / progress.length, 100);

                      leftTime = ((Date.now() - downloadStartedAt) * (100 - overallProgress)) / overallProgress;
                      ref.componentInstance.leftTime = leftTime;
                    }
                  },
                  error: (error: HttpErrorResponse) => {
                    console.error(error);
                    errorMessage = error?.message;
                  },
                });
              } catch (error: any) {
                console.error(error);
                errorMessage = error?.message;

                if (ref) {
                  ref.componentInstance.error = errorMessage;
                }
              }
            } else {
              errorMessage = 'Missing audio URL';
              close();
              openModal<UrlModeModalComponent>(this.modalService, UrlModeModalComponent, UrlModeModalComponent.options, {
                error: errorMessage,
              });
            }
          },
        ),
      ),
    { dispatch: false },
  );
}
