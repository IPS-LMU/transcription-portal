import {Subject} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {OHConfiguration} from '../obj/oh-config';
import {AppSettings} from './app.settings';
import {Injectable} from '@angular/core';

@Injectable()
export class SettingsService {
  constructor(private http: HttpClient) {
    this.http.get('config/config.json', {
      responseType: 'json'
    }).subscribe((json) => {
      AppSettings.init(json as OHConfiguration);

      this._settingsload.next();
      this._allLoaded = true;
    }, (err) => {
      alert('Error: app configuration not loaded. Please check the config.json');
      console.error(err);
    });
  }

  private _allLoaded = false;

  get allLoaded(): boolean {
    return this._allLoaded;
  }

  private _settingsload: Subject<void> = new Subject<void>();

  get settingsload(): Subject<void> {
    return this._settingsload;
  }
}
