import { HttpClient } from '@angular/common/http';
import { inject, Injectable, OnDestroy } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { sum } from '@octra/api-types';
import { ASRSettings, NgbModalWrapper, openModal, ServiceProvider } from '@octra/ngx-components';
import { OctraAPIService } from '@octra/ngx-octra-api';
import { downloadFile } from '@octra/ngx-utilities';
import { extractFileNameFromURL, isNumber, SubscriptionManager } from '@octra/utilities';
import * as jQuery from 'jquery';
import { MaintenanceWarningSnackbar } from 'maintenance-warning-snackbar';
import { BehaviorSubject, firstValueFrom, map, merge, Observable, Subscription, timer } from 'rxjs';
import * as X2JS from 'x2js';
import { environment } from '../../environments/environment';
import { UrlModeModalComponent } from '../modals/url-mode-modal/url-mode-modal.component';
import { OHConfiguration } from '../obj/oh-config';
import { TaskService } from '../obj/tasks/task.service';
import { TPortalFileInfo } from '../obj/TPortalFileInfoAttributes';
import { RoutingService } from '../routing.service';
import { AppSettings } from './app.settings';

@Injectable({ providedIn: 'root' })
export class SettingsService implements OnDestroy {
  private http = inject(HttpClient);
  private taskService = inject(TaskService);
  private activeRoute = inject(ActivatedRoute);
  private modalService = inject(NgbModal);
  private routingService = inject(RoutingService);

  public shortCutsEnabled = true;
  private _feedbackEnabled = false;
  private subscrManager = new SubscriptionManager<Subscription>();

  private _translationServiceProvider?: ServiceProvider;

  get translationServiceProvider(): ServiceProvider | undefined {
    return this._translationServiceProvider;
  }

  get feedbackEnabled(): boolean {
    return this._feedbackEnabled;
  }

  private _settingsload = new BehaviorSubject<boolean>(false);

  get settingsload(): BehaviorSubject<boolean> {
    return this._settingsload;
  }

  constructor() {
    this.subscrManager.add(
      this.activeRoute.queryParams.subscribe(
        (param: { audio?: string; transcript?: string; audio_language?: string; audio_type?: string; transcript_type?: string }) => {
          this.subscrManager.add(
            this.taskService.dbImported.subscribe({
              next: () => {
                let audioURL: string | undefined;
                let audioLanguage: string | undefined;
                let audioType: string | undefined;
                let transcriptURL: string | undefined;
                let transcriptType: string | undefined;

                if (Object.keys(param).includes('audio') && param.audio) {
                  audioURL = decodeURIComponent(param.audio);
                  console.log(`audioURL: ${audioURL}`);
                }

                if (Object.keys(param).includes('audio_language') && param.audio_language) {
                  audioLanguage = decodeURIComponent(param.audio_language);
                  console.log(`audioLanguage: ${audioLanguage}`);
                }

                if (Object.keys(param).includes('audio_type') && param.audio_type) {
                  audioType = decodeURIComponent(param.audio_type);
                  console.log(`audioType: ${audioType}`);
                }

                if (Object.keys(param).includes('transcript') && param.transcript) {
                  transcriptURL = decodeURIComponent(param.transcript);
                  console.log(`transcriptURL: ${transcriptURL}`);
                }

                if (Object.keys(param).includes('transcript_type') && param.transcript_type) {
                  transcriptType = decodeURIComponent(param.transcript_type);
                  console.log(`transcriptType: ${transcriptType}`);
                }

                if (audioURL) {
                  this.readFilesFromURL(audioURL, audioType, transcriptURL, transcriptType).catch((e) => {
                    console.error(`READ files from URL ERROR: ${e.message}`);
                  });
                  this.readAudioLanguageFromURL(audioLanguage).catch((e) => {
                    console.error(`READ audioLanguage from URL ERROR: ${e.message}`);
                  });
                }
              },
            }),
          );
        },
      ),
    );
  }

  public async updateASRQuotaInfo(json: OHConfiguration): Promise<void> {
    const results = [];
    for (const service of json.api.services) {
      if (service.type === 'ASR' && json.api.asrQuotaInfoURL) {
        results.push(await this.getASRQuotaInfo(json.api.asrQuotaInfoURL, service.provider));
      }
    }

    for (const result of results) {
      const serviceIndex = json.api.services.findIndex((a) => a.provider === result.asrName);

      if (serviceIndex > -1) {
        json.api.services[serviceIndex].usedQuota = result.usedQuota;
        json.api.services[serviceIndex].quotaPerMonth = result.monthlyQuota;
      } else {
        console.error(`could not find ${result.asrName}`);
      }
    }

    return;
  }

  getASRQuotaInfo(url: string, asrName: string) {
    return new Promise<{
      asrName: string;
      monthlyQuota?: number;
      usedQuota?: number;
    }>((resolve, reject) => {
      this.http
        .get(`${url}?ASRType=call${asrName}ASR`, {
          responseType: 'text',
          headers: {
            ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
          },
        })
        .subscribe({
          next: (result) => {
            const x2js = new X2JS();
            const response: any = x2js.xml2js(result);
            const asrQuotaInfo: {
              asrName: string;
              monthlyQuota?: number;
              usedQuota?: number;
            } = {
              asrName,
            };

            if (response.basQuota) {
              const info = {
                monthlyQuota:
                  response.basQuota && response.basQuota.monthlyQuota && isNumber(response.basQuota.monthlyQuota)
                    ? Number(response.basQuota.monthlyQuota)
                    : null,
                secsAvailable:
                  response.basQuota && response.basQuota.secsAvailable && isNumber(response.basQuota.secsAvailable)
                    ? Number(response.basQuota.secsAvailable)
                    : null,
              };

              if (info.monthlyQuota && info.monthlyQuota !== 999999) {
                asrQuotaInfo.monthlyQuota = info.monthlyQuota;
              }

              if (info.monthlyQuota && info.secsAvailable !== undefined && info.secsAvailable !== null && info.secsAvailable !== 999999) {
                asrQuotaInfo.usedQuota = info.monthlyQuota - info.secsAvailable;
              }
            }

            resolve(asrQuotaInfo);
          },
          error: (e) => {
            resolve({
              asrName,
            });
          },
        });
    });
  }

  public getMAUSLanguages(asrSettings?: ASRSettings): Promise<
    {
      ParameterValue: { Value: string; Description: string };
    }[]
  > {
    if (asrSettings?.basConfigURL) {
      return firstValueFrom(
        this.http.get<
          {
            ParameterValue: { Value: string; Description: string };
          }[]
        >(`${asrSettings.basConfigURL}?path=CMD/Components/BASWebService/Service/Operations/runPipeline/Input/LANGUAGE/Values/`, {
          responseType: 'json',
          headers: {
            ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
          },
        }),
      );
    } else {
      return Promise.resolve([]);
    }
  }

  public getASRLanguages(asrSettings?: ASRSettings): Promise<
    {
      ParameterValue: { Value: string; Description: string };
    }[]
  > {
    if (asrSettings?.basConfigURL) {
      return firstValueFrom(
        this.http.get<
          {
            ParameterValue: { Value: string; Description: string };
          }[]
        >(`${asrSettings.basConfigURL}?path=CMD/Components/BASWebService/Service/Operations/runASR/Input/LANGUAGE/Values`, {
          responseType: 'json',
          headers: {
            ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
          },
        }),
      );
    } else {
      return Promise.resolve([]);
    }
  }

  public getActiveASRProviders(asrSettings?: ASRSettings): Promise<
    {
      ParameterValue: { Value: string; Description: string };
    }[]
  > {
    if (asrSettings?.basConfigURL) {
      return firstValueFrom(
        this.http.get<
          {
            ParameterValue: { Value: string; Description: string };
          }[]
        >(`${asrSettings.basConfigURL}?path=CMD/Components/BASWebService/Service/Operations/runASR/Input/ASRType/Values/`, {
          responseType: 'json',
          headers: {
            ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
          },
        }),
      );
    } else {
      return Promise.resolve([]);
    }
  }

  private async readFilesFromURL(audioURL: string | undefined, audioType?: string, transcriptURL?: string, transcriptType?: string) {
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

        merge(...observables).subscribe((event) => {
          const index = progress.findIndex((a: any) => a.downloadURL === event.downloadURL);

          if (index > -1) {
            progress[index].progress = event.progress;

            if (event.result) {
              progress[index].result = event.result;

              if (progress.filter((a) => a.result !== undefined).length === observables.length) {
                // retrieving files finished
                const filename = `from_url_${new Date().toLocaleString().replace(/, /g, '_').replace(/[ .:]/g, '-')}`;
                for (const progressElement of progress) {
                  let mediaType: string | undefined;

                  if (progressElement.downloadURL.includes('?')) {
                    const matches = /mediatype=([^&]+)/g.exec(progressElement.downloadURL);
                    mediaType = matches ? matches[1] : undefined;
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
                  this.subscrManager.add(
                    timer(0).subscribe({
                      next: () => {
                        // TODO select preprocessor by mode
                        this.taskService.state.modes.annotation.preprocessor.addToQueue(info);
                      },
                    }),
                  );
                }

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
        });
      } catch (error) {
        close();
      }
    } else {
      alert('Missing audio URL');
    }
  }

  private async readAudioLanguageFromURL(audioLanguage?: string) {
    if (audioLanguage && /(^deu)|(^ita)|(^nld)|(^eng)/g.exec(audioLanguage)) {
      const supportedAudioLanguages = AppSettings.languages.asr.filter((a) => /(^deu-)|(^ita-)|(^nld-)|(^eng-)/g.exec(a.value));
      const supportedMausLanguages = AppSettings.languages.maus.filter((a) => /(^deu-)|(^ita-)|(^nld-)|(^eng-)/g.exec(a.value));

      if (audioLanguage === 'deu') {
        audioLanguage = 'deu-DE';
      } else if (audioLanguage === 'en') {
        audioLanguage = 'en-GB';
      } else if (audioLanguage === 'nld') {
        audioLanguage = 'nld-NL';
      } else if (audioLanguage === 'ita') {
        audioLanguage = 'ita-IT';
      }

      this.taskService.state.currentModeState.selectedASRLanguage = supportedAudioLanguages.find((a) => a.value.includes(audioLanguage!))?.value;
      this.taskService.state.currentModeState.selectedMausLanguage = supportedMausLanguages.find((a) => a.value.includes(audioLanguage!))?.value;

      if (this.taskService.state.currentModeState.selectedMausLanguage) {
        this.taskService.state.currentModeState.selectedASRProvider = AppSettings.getServiceInformation('Watson'); // Watson is default
      }
    }
  }

  ngOnDestroy() {
    this.subscrManager.destroy();
  }
}
