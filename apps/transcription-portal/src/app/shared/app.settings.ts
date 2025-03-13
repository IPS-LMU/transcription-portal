import { OHConfiguration, ProviderLanguage } from '../obj/oh-config';

export class AppSettings {
  private static _configuration: OHConfiguration;
  public static languages: {
    asr: ProviderLanguage[];
    maus: ProviderLanguage[];
  } = {
    asr: [],
    maus: [],
  };

  public static get configuration(): OHConfiguration {
    return AppSettings._configuration;
  }

  public static init(configuration: OHConfiguration) {
    this._configuration = configuration;
  }

  public static getLanguageByCode(
    code: string,
    asr: string,
  ): ProviderLanguage | undefined {
    if (!asr) {
      return undefined;
    }

    return this.languages.asr.find((a) => {
      return (
        (a.value === code &&
          (!a.providersOnly || a.providersOnly.length === 0)) ||
        a.providersOnly?.includes(asr)
      );
    });
  }

  public static getServiceInformation(serviceProvider: string) {
    if (!AppSettings.configuration.api.services) {
      throw new Error('services configuration is undefined');
    }
    return AppSettings.configuration.api.services.find((a) => {
      return a.provider === serviceProvider;
    });
  }
}
