import {Injectable} from '@angular/core';
import {Observable} from 'rxjs';
import {HttpClient} from '@angular/common/http';
import {BugReporter} from '../obj/BugAPI/BugReporter';
import {AppInfo} from '../app.info';
import {BrowserInfo} from '../obj/BrowserInfo';
import {StorageService} from '../storage.service';
import {EmailBugReporter} from '../obj/BugAPI/EmailBugReporter';
import * as moment from 'moment';

export enum ConsoleType {
  LOG,
  INFO,
  WARN,
  ERROR
}

export interface ConsoleEntry {
  type: ConsoleType;
  timestamp: string;
  message: string;
}

@Injectable()
export class BugReportService {
  get console(): ConsoleEntry[] {
    return this._console;
  }

  private _console: ConsoleEntry[] = [];
  private reporter: BugReporter;

  constructor(private appStorage: StorageService,
              private http: HttpClient) {
  }

  public init() {
  }

  public get hasErrors(): boolean {
    const errors = this._console.filter((entry) => {
      return (entry.type === ConsoleType.ERROR);
    });

    return (errors.length > 0);
  }

  public addEntry(type: ConsoleType, message: any) {
    if (typeof message !== 'string') {
      message = JSON.stringify(message);
    }

    const consoleItem: ConsoleEntry = {
      type: type,
      timestamp: moment().format('DD.MM.YY HH:mm:ss'),
      message: message
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

  sendReport(email: string, description: string, sendbugreport: boolean, credentials: {
    auth_token: string,
    url: string
  }): Observable<any> {
    const auth_token = credentials.auth_token;
    const url = credentials.url;
    const form = {
      email: email,
      description: description
    };

    return new EmailBugReporter().sendBugReport(this.http, this.getPackage(), form, url, auth_token, sendbugreport);
  }

}
