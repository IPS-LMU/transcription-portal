import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {SettingsService} from './settings.service';
import {HttpClient} from '@angular/common/http';
import * as moment from 'moment';
import {BugReporter} from '../obj/BugAPI/BugReporter';
import {StorageService} from '../storage.service';
import {AppInfo} from '../app.info';
import {BrowserInfo} from '../obj/BrowserInfo';
import {EmailBugReporter} from '../obj/BugAPI/EmailBugReporter';
import {isUnset} from '@octra/utilities';

export enum ConsoleType {
  LOG,
  INFO,
  WARN,
  ERROR
}

export interface ConsoleEntry {
  type: ConsoleType;
  timestamp: string;
  message: any;
}

@Injectable()
export class BugReportService {
  private reporter: BugReporter;
  private _console: ConsoleEntry[] = [];

  get console(): ConsoleEntry[] {
    return this._console;
  }

  constructor(private appStorage: StorageService,
              private settService: SettingsService,
              private http: HttpClient) {
    this.reporter = new EmailBugReporter();
  }

  public get hasErrors(): boolean {
    const errors = this._console.filter((entry) => {
      return (entry.type === ConsoleType.ERROR);
    });

    return (errors.length > 0);
  }

  public addEntry(type: ConsoleType, message: any) {
    let sanitizedMessage: any = message;

    if (typeof message === 'string') {
      sanitizedMessage = sanitizedMessage.replace(/(ACCESSCODE=)([^&\n]+)/g, '$1****');
    } else {
      if (sanitizedMessage.hasOwnProperty(message)) {
        sanitizedMessage.message = sanitizedMessage.message.replace(/(ACCESSCODE=)([^&\n]+)/g, '$1****');
      } else if (sanitizedMessage.hasOwnProperty('text')) {
        sanitizedMessage.text = sanitizedMessage.text.replace(/(ACCESSCODE=)([^&\n]+)/g, '$1****');
      }
    }

    const consoleItem: ConsoleEntry = {
      type,
      timestamp: moment().format('DD.MM.YY HH:mm:ss'),
      message: sanitizedMessage
    };

    this._console.push(consoleItem);
  }

  public clear() {
    this._console = [];
  }

  public getPackage(): any {
    return {
      ohportal: {
        version: AppInfo.version,
        url: window.location.href,
        lastUpdated: AppInfo.lastUpdated
      },
      system: {
        os: {
          name: BrowserInfo.os.family,
          version: BrowserInfo.os.version
        },
        browser: BrowserInfo.browser + ' ' + BrowserInfo.version,
        version: BrowserInfo.os.version
      },
      entries: this._console
    };
  }

  sendReport(name: string, email: string, description: string, sendbugreport: boolean, credentials: {
    auth_token: string,
    url: string
  },         screenshots: any[]): Observable<any> {

    if (!(isUnset(credentials))) {
      const auth_token = credentials.auth_token;
      const url = credentials.url;
      const form = {
        email,
        name,
        description
      };

      return this.reporter.sendBugReport(this.http, this.getPackage(), form, url, auth_token, sendbugreport, screenshots);
    }

    return null;
  }

}
