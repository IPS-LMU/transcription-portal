import {OHConfiguration, OHLanguageObject} from '../obj/oh-config';

export class AppSettings {

  public static get configuration(): OHConfiguration {
    return AppSettings._configuration;
  }

  private static _configuration: OHConfiguration;

  public static init(configuration: OHConfiguration) {
    this._configuration = configuration;
  }

  public static getLanguageByCode(code: string, asr: string): OHLanguageObject {
    if ((asr === null || asr === undefined)) {
      return null;
    }

    return this.configuration.api.languages.find((a) => {
      return a.code === code && a.asr === asr;
    });
  }

  public static getServiceInformation(serviceProvider: string) {
    if (!(AppSettings.configuration.api.services === null || AppSettings.configuration.api.services === undefined)) {
      return AppSettings.configuration.api.services.find((a) => {
        console.log(`check '${a.provider}' === '${serviceProvider}'`);
        return a.provider === serviceProvider;
      });
    }

    return undefined;
  }
}
