import {BugReporter} from './BugReporter';
import {Observable} from 'rxjs';
import {HttpClient, HttpResponse} from '@angular/common/http';

export class EmailBugReporter extends BugReporter {
  constructor() {
    super();
    this._name = 'Email';
  }

  public sendBugReport(http: HttpClient, pkg: any, form: any, url: string,
                       authToken: string, sendbugreport: boolean): Observable<HttpResponse<any>> {

    const report = (sendbugreport) ? pkg : {};

    const json = pkg;

    const body = {
      description: form.description,
      additional_information: {
        email: form.email
      },
      os: json.system.os.name,
      os_build: json.system.os.version,
      platform: json.system.browser,
      version: json.ohportal.version,
      report
    };

    return http.post(url, JSON.stringify(body), {
      headers: {
        Authorization: authToken
      },
      observe: 'response',
      responseType: 'json'
    });
  }

  public getText(pkg: any): string {
    let result = '';

    for (const attr in pkg) {
      if (pkg.hasOwnProperty(attr)) {
        if (!Array.isArray(pkg[attr]) && typeof pkg[attr] === 'object') {
          result += attr + '\n';
          result += '---------\n';

          for (const attr2 in pkg[attr]) {
            if (pkg[attr].hasOwnProperty(attr2) && typeof pkg[attr][attr2] !== 'object' || pkg[attr][attr2] === null) {
              result += '  ' + attr2 + ':  ' + pkg[attr][attr2] + '\n';
            }
          }
        } else if (Array.isArray(pkg[attr])) {
          result += attr + '\n';
          result += '---------\n';

          for (const pkgElement of pkg[attr]) {
            if (typeof pkgElement.message === 'string') {
              result += '  ' + pkgElement.type + '  ' + pkgElement.message + '\n';
            } else if (typeof pkgElement.message === 'object') {
              result += '  ' + pkgElement.type + '\n' + JSON.stringify(pkgElement.message, null, 2) + '\n';
            }
          }
        }
        result += '\n';
      }
    }

    return result;
  }
}
