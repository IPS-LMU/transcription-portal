import {Subject} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {OHConfiguration} from '../obj/oh-config';
import {AppSettings} from './app.settings';
import {Injectable} from '@angular/core';
import {isUnset} from '@octra/utilities';

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
    this.http.get('config/config.json', {
      responseType: 'json'
    }).subscribe((json: OHConfiguration) => {
      const initSettings = () => {
        AppSettings.init(json);
        this._settingsload.next();
        this._allLoaded = true;
      };

      if (!isUnset(json.api.asrInfoURL) && json.api.asrInfoURL.trim() !== '') {
        this.http.get(
          json.api.asrInfoURL,
          {responseType: 'text'}
        ).subscribe(
          (result) => {
            const html = jQuery(result);
            const basTable = html.find('#bas-asr-service-table');
            const basASRInfoContainers = basTable.find('.bas-asr-info-container');

            const asrInfos: {
              name: string;
              maxSignalDuration: number;
              maxSignalSize: number;
              quotaPerMonth: number;
              termsURL: string;
              dataStoragePolicy: string;
              knownIssues: string;
            }[] = [];

            jQuery.each(basASRInfoContainers, (key, elem) => {
              const isStringNumber = (str: string) => !isNaN(Number(str));
              const sanitizeNumberValue = (el: any, attr: string) => {
                if (!isUnset(el[attr]) && isStringNumber(el[attr])) {
                  el[attr] = Number(el[attr]);
                } else {
                  el[attr] = undefined;
                }
              };
              const sanitizeStringValue = (el: any, attr: string) => {
                if (!isUnset(el[attr]) && typeof el[attr] === 'string') {
                  el[attr] = el[attr].replace(/[\n\t\r]+/g, '');
                } else {
                  el[attr] = undefined;
                }
              };

              const newElem = {
                name: jQuery(elem).attr('data-bas-asr-info-provider-name'),
                maxSignalDuration: jQuery(elem).find('.bas-asr-info-max-signal-duration-seconds').attr('data-value'),
                maxSignalSize: jQuery(elem).find('.bas-asr-info-max-signal-size-megabytes').attr('data-value'),
                quotaPerMonth: jQuery(elem).find('.bas-asr-info-quota-per-month-seconds').attr('data-value'),
                termsURL: jQuery(elem).find('.bas-asr-info-eula-link').attr('href'),
                dataStoragePolicy: jQuery(elem).find('.bas-asr-info-data-storage-policy').text(),
                knownIssues: jQuery(elem).find('.bas-asr-info-known-issues').text()
              };

              sanitizeNumberValue(newElem, 'maxSignalDuration');
              sanitizeNumberValue(newElem, 'maxSignalSize');
              sanitizeNumberValue(newElem, 'quotaPerMonth');
              sanitizeStringValue(newElem, 'dataStoragePolicy');
              sanitizeStringValue(newElem, 'knownIssues');
              newElem.knownIssues = (newElem.knownIssues.trim() === 'none') ? undefined : newElem.knownIssues;

              asrInfos.push(newElem);
            });

            // overwrite data of config
            for (const service of json.api.services) {
              if (!isUnset(service.basName)) {
                const basInfo = asrInfos.find(a => a.name === service.basName);
                if (!isUnset(basInfo)) {
                  service.dataStoragePolicy = (!isUnset(basInfo.dataStoragePolicy))
                    ? basInfo.dataStoragePolicy : service.dataStoragePolicy;

                  service.maxSignalDuration = (!isUnset(basInfo.maxSignalDuration))
                    ? basInfo.maxSignalDuration : service.maxSignalDuration;

                  service.maxSignalSize = (!isUnset(basInfo.maxSignalSize))
                    ? basInfo.maxSignalSize : service.maxSignalSize;

                  service.knownIssues = (!isUnset(basInfo.knownIssues))
                    ? basInfo.knownIssues : service.knownIssues;

                  service.quotaPerMonth = (!isUnset(basInfo.quotaPerMonth))
                    ? basInfo.quotaPerMonth : service.quotaPerMonth;

                  service.termsURL = (!isUnset(basInfo.termsURL))
                    ? basInfo.termsURL : service.termsURL;
                }
              }
            }
            initSettings();
          },
          (e) => {
            console.error(e);
            initSettings();
          });
      } else {
        initSettings();
      }
    }, (err) => {
      alert('Error: app configuration not loaded. Please check the config.json');
      console.error(err);
    });
  }
}
