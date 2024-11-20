import { Injectable } from '@angular/core';
import { FeedbackRequestPropertiesDto } from '@octra/api-types';
import { OctraAPIService, removeProperties } from '@octra/ngx-octra-api';
import { hasProperty } from '@octra/utilities';
import { DateTime } from 'luxon';
import { Observable } from 'rxjs';
import { AppInfo } from '../app.info';
import { BrowserInfo } from '../obj/BrowserInfo';

export enum ConsoleType {
  LOG,
  INFO,
  WARN,
  ERROR,
}

export interface ConsoleEntry {
  type: ConsoleType;
  timestamp: string;
  message: any;
}

@Injectable()
export class BugReportService {
  private _console: ConsoleEntry[] = [];

  get console(): ConsoleEntry[] {
    return this._console;
  }

  constructor(
    private octraAPI: OctraAPIService
  ) {}

  public get hasErrors(): boolean {
    const errors = this._console.filter((entry) => {
      return entry.type === ConsoleType.ERROR;
    });

    return errors.length > 0;
  }

  public addEntry(type: ConsoleType, message: any) {
    let sanitizedMessage: any = message;

    if (typeof message === 'string') {
      sanitizedMessage = sanitizedMessage.replace(
        /(ACCESSCODE=)([^&\n]+)/g,
        '$1****'
      );
    } else {
      if (hasProperty(sanitizedMessage, 'message')) {
        sanitizedMessage.message = sanitizedMessage.message.replace(
          /(ACCESSCODE=)([^&\n]+)/g,
          '$1****'
        );
      } else if (hasProperty(sanitizedMessage, 'text')) {
        sanitizedMessage.text = sanitizedMessage.text.replace(
          /(ACCESSCODE=)([^&\n]+)/g,
          '$1****'
        );
      }
    }

    const consoleItem: ConsoleEntry = {
      type,
      timestamp: DateTime.now().toFormat('DD.MM.YY HH:mm:ss'),
      message: sanitizedMessage,
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
        lastUpdated: AppInfo.lastUpdated,
      },
      system: {
        os: {
          name: BrowserInfo.os.family,
          version: BrowserInfo.os.version,
        },
        browser: BrowserInfo.browser + ' ' + BrowserInfo.version,
        version: BrowserInfo.os.version,
      },
      entries: this._console,
    };
  }

  sendBugReport(
    name: string,
    email: string,
    message: string,
    sendProtocol: boolean,
    screenshots: any[]
  ): Observable<any> {
    let pkg: FeedbackRequestPropertiesDto = {
      type: 'bug',
      message,
      requester: {
        name,
        email,
      },
      technicalInformation: {
        os: {
          name: BrowserInfo.os.family,
          version: BrowserInfo.os.version,
        },
        browser: {
          name: BrowserInfo.browser,
          version: BrowserInfo.version,
        },
      },
    };

    let protocol: File | undefined = new File(
      [
        JSON.stringify({
          tool: {
            version: AppInfo.version,
            language: "en",
            signed_in: true,
            url: window.location.href,
          },
          entries: this.console,
        }),
      ],
      `OCB_protocol_${Date.now()}.json`,
      { type: 'application/json' }
    );

    if (!sendProtocol) {
      pkg = removeProperties(pkg, ['technicalInformation']);
      protocol = undefined;
    }

    return this.octraAPI.sendFeedback(
      pkg,
      protocol,
      screenshots.map((a) => a.blob)
    );
  }
}
