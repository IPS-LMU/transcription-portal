import {Subject} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {OHConfiguration} from '../obj/oh-config';
import {AppSettings} from './app.settings';
import {Injectable} from '@angular/core';
import {isNumber} from '@octra/utilities';
import * as X2JS from 'x2js';
import * as jQuery from 'jquery';

@Injectable()
export class SettingsService {
  public shortCutsEnabled = true;
  private _allLoaded = false;

  get allLoaded(): boolean {
    return this._allLoaded;
  }

  private _settingsload: Subject<void> = new Subject<void>();

  get settingsload(): Subject<void> {
    return this._settingsload;
  }

  constructor(private http: HttpClient) {
    this.http.get<OHConfiguration>('config/config.json', {
      responseType: 'json'
    }).subscribe({
      next: (json: OHConfiguration) => {
        AppSettings.init(json);
        this._settingsload.next();
        this._allLoaded = true;
      },
      error: (err) => {
        alert('Error: app configuration not loaded. Please check the config.json');
        console.error(err);
      }
    });
  }

  updateASRInfo(json: OHConfiguration): Promise<void> {
    return new Promise<void>((resolve) => {
      if (json.api.asrInfoURL && json.api.asrInfoURL?.trim() !== '') {
        this.http.get(
          json.api.asrInfoURL,
          {responseType: 'text'}
        ).subscribe({
          next: (result) => {
            const html = jQuery(result);
            const basTable = html.find('#bas-asr-service-table');
            const basASRInfoContainers = basTable.find('.bas-asr-info-container');

            const asrInfos: {
              name?: string,
              maxSignalDuration?: number,
              maxSignalSize?: number,
              quotaPerMonth?: number,
              termsURL?: string,
              dataStoragePolicy?: string,
              knownIssues?: string
            }[] = [];

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
                name?: string,
                maxSignalDuration?: number,
                maxSignalSize?: number,
                quotaPerMonth?: number,
                termsURL?: string,
                dataStoragePolicy?: string,
                knownIssues?: string
              } = {
                name,
                maxSignalDuration: Number(jQuery(elem).find('.bas-asr-info-max-signal-duration-seconds').attr('data-value')),
                maxSignalSize: Number(jQuery(elem).find('.bas-asr-info-max-signal-size-megabytes').attr('data-value')),
                quotaPerMonth: Number(jQuery(elem).find('.bas-asr-info-quota-per-month-seconds').attr('data-value')),
                termsURL: jQuery(elem).find('.bas-asr-info-eula-link').attr('href'),
                dataStoragePolicy: jQuery(elem).find('.bas-asr-info-data-storage-policy').text(),
                knownIssues: jQuery(elem).find('.bas-asr-info-known-issues').text()
              };

              sanitizeNumberValue(newElem, 'maxSignalDuration');
              sanitizeNumberValue(newElem, 'maxSignalSize');
              sanitizeNumberValue(newElem, 'quotaPerMonth');
              sanitizeStringValue(newElem, 'dataStoragePolicy');
              sanitizeStringValue(newElem, 'knownIssues');
              newElem.knownIssues = (newElem.knownIssues?.trim() === 'none') ? undefined : newElem.knownIssues;

              asrInfos.push(newElem);
            });

            // overwrite data of config
            for (const service of json.api.services) {
              if (service.basName) {
                const basInfo = asrInfos.find(a => a.name === service.basName);
                if (basInfo !== undefined) {
                  service.dataStoragePolicy = basInfo.dataStoragePolicy ?? service.dataStoragePolicy;
                  service.maxSignalDuration = basInfo.maxSignalDuration ?? service.maxSignalDuration;
                  service.maxSignalSize = basInfo.maxSignalSize ?? service.maxSignalSize;
                  service.knownIssues = basInfo.knownIssues ?? service.knownIssues;
                  service.quotaPerMonth = basInfo.quotaPerMonth ?? service.quotaPerMonth;
                  service.termsURL = basInfo.termsURL ?? service.termsURL;
                }
              }
            }
            this.updateASRQuotaInfo(json).then(() => {
              resolve();
            });
          },
          error: (e) => {
            console.error(e);
            resolve(e);
          }
        });
      } else {
        resolve();
      }
    });
  }

  public async updateASRQuotaInfo(json: OHConfiguration): Promise<void> {
    const results = [];
    for (const service of json.api.services) {
      if (service.type === 'ASR' && json.api.asrQuotaInfoURL) {
        results.push(await this.getASRQuotaInfo(json.api.asrQuotaInfoURL, service.provider));
      }
    }

    for (const result of results) {
      const serviceIndex = json.api.services.findIndex(a => a.provider === result.asrName);

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
      monthlyQuota?: number,
      usedQuota?: number
    }>((resolve, reject) => {
      this.http.get(
        `${url}?ASRType=call${asrName}ASR`,
        {responseType: 'text'}
      ).subscribe((result) => {
        const x2js = new X2JS();
        const response: any = x2js.xml2js(result);
        const asrQuotaInfo: {
          asrName: string;
          monthlyQuota?: number,
          usedQuota?: number
        } = {
          asrName
        };

        if (response.basQuota) {
          const info = {
            monthlyQuota: (response.basQuota && response.basQuota.monthlyQuota && isNumber(response.basQuota.monthlyQuota))
              ? Number(response.basQuota.monthlyQuota) : null,
            secsAvailable: (response.basQuota && response.basQuota.secsAvailable && isNumber(response.basQuota.secsAvailable))
              ? Number(response.basQuota.secsAvailable) : null
          };

          if (info.monthlyQuota && info.monthlyQuota !== 999999) {
            asrQuotaInfo.monthlyQuota = info.monthlyQuota;
          }

          if (info.monthlyQuota && info.secsAvailable !== undefined && info.secsAvailable !== null && info.secsAvailable !== 999999) {
            asrQuotaInfo.usedQuota = info.monthlyQuota - info.secsAvailable;
          }
        }

        resolve(asrQuotaInfo);
      });
    });
  }
}
