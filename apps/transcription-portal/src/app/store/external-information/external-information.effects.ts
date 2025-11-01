import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { isNumber } from '@octra/utilities';
import * as jQuery from 'jquery';
import { catchError, exhaustMap, forkJoin, map, Observable, of, retry, tap, withLatestFrom } from 'rxjs';
import * as X2JS from 'x2js';
import { environment } from '../../../environments/environment';
import { AppSettings } from '../../shared/app.settings';
import { AppActions, RootState } from '../app';
import { ASRInfo, ExternalInformationActions } from './external-information.actions';

@Injectable()
export class ExternalInformationEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  private http = inject(HttpClient);

  private readonly retryAfterFail = 3;

  updateASRQuotaInfo$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadSettings.success),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        const settings = state.app.settings!;
        return forkJoin(
          settings.api.services
            .filter((service) => service.type === 'ASR' && settings.api.asrQuotaInfoURL && service.provider !== 'LSTWhisperX')
            .map((a) => this.getASRQuotaInfo(settings.api.asrQuotaInfoURL!, a.provider)),
        ).pipe(
          exhaustMap((asrQuotaInfo) => of(ExternalInformationActions.updateASRQuotaInfo.success({ asrQuotaInfo }))),
          retry(this.retryAfterFail),
          catchError((err: HttpErrorResponse) =>
            of(
              ExternalInformationActions.updateASRQuotaInfo.fail({
                error: err.error?.message ?? err.message,
              }),
            ),
          ),
        );
      }),
    ),
  );

  updateASRInfo$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadSettings.success),
      withLatestFrom(this.store),
      exhaustMap(([action, state]) => {
        const settings = state.app.settings!;
        return this.http
          .get(settings.api.asrInfoURL, {
            responseType: 'text',
            headers: {
              ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
            },
          })
          .pipe(
            exhaustMap((result: string) => {
              const html = jQuery(result);
              const basTable = html.find('#bas-asr-service-table');
              const basASRInfoContainers = basTable.find('.bas-asr-info-container');

              const asrInfos: ASRInfo[] = [];

              jQuery.each(basASRInfoContainers, (key, elem) => {
                const name = jQuery(elem).attr('data-bas-asr-info-provider-name');
                const isStringNumber = (str: string) => !isNaN(Number(str));
                const sanitizeNumberValue = (el: any, attr: string) => {
                  if (el[attr] && isStringNumber(el[attr])) {
                    el[attr] = Number(el[attr]);
                  } else {
                    el[attr] = undefined;
                  }
                };
                const sanitizeStringValue = (el: any, attr: string) => {
                  if (el[attr] && typeof el[attr] === 'string') {
                    el[attr] = el[attr].replace(/[\n\t\r]+/g, '');
                  } else {
                    el[attr] = undefined;
                  }
                };

                const newElem: {
                  name?: string;
                  maxSignalDuration?: number;
                  maxSignalSize?: number;
                  quotaPerMonth?: number;
                  termsURL?: string;
                  dataStoragePolicy?: string;
                  knownIssues?: string;
                } = {
                  name,
                  maxSignalDuration: Number(jQuery(elem).find('.bas-asr-info-max-signal-duration-seconds').attr('data-value')),
                  maxSignalSize: Number(jQuery(elem).find('.bas-asr-info-max-signal-size-megabytes').attr('data-value')),
                  quotaPerMonth: Number(jQuery(elem).find('.bas-asr-info-quota-per-month-seconds').attr('data-value')),
                  termsURL: jQuery(elem).find('.bas-asr-info-eula-link').attr('href'),
                  dataStoragePolicy: jQuery(elem).find('.bas-asr-info-data-storage-policy').text(),
                  knownIssues: jQuery(elem).find('.bas-asr-info-known-issues').text(),
                };

                sanitizeNumberValue(newElem, 'maxSignalDuration');
                sanitizeNumberValue(newElem, 'maxSignalSize');
                sanitizeNumberValue(newElem, 'quotaPerMonth');
                sanitizeStringValue(newElem, 'dataStoragePolicy');
                sanitizeStringValue(newElem, 'knownIssues');
                newElem.knownIssues = newElem.knownIssues?.trim() === 'none' ? undefined : newElem.knownIssues;

                asrInfos.push(newElem);
              });

              return of(
                ExternalInformationActions.updateASRInfo.success({
                  asrInfos,
                }),
              );
            }),
            retry(this.retryAfterFail),
            catchError((err: HttpErrorResponse) =>
              of(
                ExternalInformationActions.updateASRInfo.fail({
                  error: err.error?.message ?? err.message,
                }),
              ),
            ),
          );
      }),
    ),
  );

  getASRLanguages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadSettings.success),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        const settings = state.app.settings!;
        if (settings.api.basConfigURL) {
          return this.http
            .get<
              {
                ParameterValue: { Value: string; Description: string };
              }[]
            >(`${settings.api.basConfigURL}?path=CMD/Components/BASWebService/Service/Operations/runASR/Input/LANGUAGE/Values`, {
              responseType: 'json',
              headers: {
                ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
              },
            })
            .pipe(
              map((asrLanguages) => {
                asrLanguages.sort((a, b) =>
                  a.ParameterValue.Description > b.ParameterValue.Description
                    ? 1
                    : a.ParameterValue.Description < b.ParameterValue.Description
                      ? -1
                      : 0,
                );
                return ExternalInformationActions.getASRLanguages.success({
                  asrLanguages,
                });
              }),
              retry(this.retryAfterFail),
              catchError((err: HttpErrorResponse) =>
                of(
                  ExternalInformationActions.getASRLanguages.fail({
                    error: err.error?.message ?? err.message,
                  }),
                ),
              ),
            );
        }

        return of(ExternalInformationActions.getASRLanguages.success({ asrLanguages: [] }));
      }),
    ),
  );

  getMausLanguages$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.loadSettings.success),
      withLatestFrom(this.store),
      exhaustMap(([, state]: [any, RootState]) => {
        const settings = state.app.settings!;

        return this.http
          .get<
            {
              ParameterValue: { Value: string; Description: string };
            }[]
          >(`${settings.api.basConfigURL}?path=CMD/Components/BASWebService/Service/Operations/runPipeline/Input/LANGUAGE/Values/`, {
            responseType: 'json',
            headers: {
              ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
            },
          })
          .pipe(
            exhaustMap((mausLanguages) => {
              mausLanguages.sort((a, b) =>
                a.ParameterValue.Description > b.ParameterValue.Description
                  ? 1
                  : a.ParameterValue.Description < b.ParameterValue.Description
                    ? -1
                    : 0,
              );

              return of(
                ExternalInformationActions.getMAUSLanguages.success({
                  mausLanguages,
                }),
              );
            }),
            retry(2),
            catchError((err: HttpErrorResponse) =>
              of(
                ExternalInformationActions.getMAUSLanguages.fail({
                  error: err.error?.message ?? err.message,
                }),
              ),
            ),
          );
      }),
    ),
  );

  onExternalInfoRetrieved$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          ExternalInformationActions.getMAUSLanguages.success,
          ExternalInformationActions.getASRLanguages.success,
          ExternalInformationActions.updateASRInfo.success,
          ExternalInformationActions.updateASRQuotaInfo.success,
        ),
        withLatestFrom(this.store),
        tap(([, state]: [any, RootState]) => {
          if (!state.app.initialized) {
            const { asrInfoRetrieved, asrQuotaRetrieved, asrLanguagesInitialized, mausLanguagesInitialized } = state.externalInformation;

            if (asrInfoRetrieved && asrQuotaRetrieved && asrLanguagesInitialized && mausLanguagesInitialized) {
              this.store.dispatch(ExternalInformationActions.loadExternInformation.success());
            }
          }
        }),
      ),
    { dispatch: false },
  );

  afterExternalInformationLoaded$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(ExternalInformationActions.loadExternInformation.success),
        withLatestFrom(this.store),
        tap(([, state]: [any, RootState]) => {
          AppSettings.languages = { ...state.externalInformation.languages };
        }),
      ),
    { dispatch: false },
  );

  private getASRQuotaInfo(
    url: string,
    asrName: string,
  ): Observable<{
    asrName: string;
    monthlyQuota?: number;
    usedQuota?: number;
  }> {
    return this.http
      .get(`${url}?ASRType=call${asrName}ASR`, {
        responseType: 'text',
        headers: {
          ...(environment.production ? { 'ngsw-bypass': 'true' } : {}),
        },
      })
      .pipe(
        map((result) => {
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
          return asrQuotaInfo;
        }),
      );
  }
}
