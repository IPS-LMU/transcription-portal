import { HttpClient, HttpHeaders } from '@angular/common/http';
import { hasProperty } from '@octra/utilities';
import { Observable } from 'rxjs';
import { BugReporter } from './BugReporter';

export class MantisBugReporter extends BugReporter {
  constructor() {
    super();
    this._name = 'MantisBT';
  }

  public sendBugReport(
    http: HttpClient,
    pkg: any,
    form: any,
    url: string,
    authToken: string,
    sendbugreport: boolean,
  ): Observable<any> {
    const report = sendbugreport ? this.getText(pkg) : '';

    let summary = form.description;
    if (summary.length > 100) {
      summary = summary.substr(0, 100) + '...';
    }

    const json = pkg;

    const body = {
      project: {
        id: 1,
      },
      category: 'General',
      summary,
      description: form.description,
      additional_information: 'Email: ' + form.email,
      os: json.system.os.name,
      os_build: json.system.os.version,
      platform: json.system.browser,
      version: json.octra.version,
    };

    if (sendbugreport) {
      body.additional_information += '\n\n' + report;
    }

    return http.post(url, JSON.stringify(body), {
      headers: {
        Authorization: authToken,
      },
      responseType: 'json',
    });
  }

  public getText(pkg: any): string {
    let result = '';

    for (const attr in pkg) {
      if (hasProperty(pkg, attr)) {
        if (!Array.isArray(pkg[attr]) && typeof pkg[attr] === 'object') {
          result += attr + '\n';
          result += '---------\n';

          for (const attr2 in pkg[attr]) {
            if (
              (hasProperty(pkg[attr], attr2) &&
                typeof pkg[attr][attr2] !== 'object') ||
              pkg[attr][attr2] === null
            ) {
              result += '  ' + attr2 + ':  ' + pkg[attr][attr2] + '\n';
            }
          }
        } else if (Array.isArray(pkg[attr])) {
          result += attr + '\n';
          result += '---------\n';

          for (const pkgElement of pkg[attr]) {
            if (typeof pkgElement.message === 'string') {
              result +=
                '  ' + pkgElement.type + '  ' + pkgElement.message + '\n';
            } else if (typeof pkgElement.message === 'object') {
              result +=
                '  ' +
                pkgElement.type +
                '\n' +
                JSON.stringify(pkgElement.message, null, 2) +
                '\n';
            }
          }
        }
        result += '\n';
      }
    }

    return result;
  }

  public getTest(http: HttpClient, url: string, authToken: string) {
    const requestOptions = {
      params: {
        id: '',
      },
      headers: new HttpHeaders(),
    };
    requestOptions.params.id = '10';
    requestOptions.headers.set('Authorization', authToken);

    const body = {
      project: {
        id: 1,
      },
    };

    return http.get(url, requestOptions);
  }
}
