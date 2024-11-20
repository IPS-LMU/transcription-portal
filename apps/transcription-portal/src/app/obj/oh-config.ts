export interface OHConfiguration {
  name: string;
  version: string;
  api: {
    commands: OHCommand[];
    languages: OHLanguageObject[];
    services: OHService[];
    asrInfoURL?: string;
    asrQuotaInfoURL?: string;
    octraBackend: {
      url: '';
      key: '';
    };
  };
  plugins: {
    emailSender: {
      authKey: string;
      url: string;
    };
    tracking?: {
      active: string;
      matomo: {
        host: string;
        siteID: number;
      };
    };
  };
  allowed_browsers: {
    name: string;
    version: string;
  }[];
}

export interface OHLanguageObject {
  code: string;
  name: string;
  asr: string;
  state: string;
  host: string;
}

export interface OHCommand {
  name: string;
  calls: string[];
}

export interface OHService {
  provider: string;
  basName?: string;
  maxSignalDuration?: number;
  maxSignalSize?: number;
  quotaPerMonth?: number;
  knownIssues?: string;
  usedQuota?: number;
  type: string;
  termsURL: string;
  dataStoragePolicy: string;
  homepageURL: string;
  logoURL: string;
}
