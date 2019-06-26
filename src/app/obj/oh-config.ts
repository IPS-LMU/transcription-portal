export interface OHConfiguration {
  'name': string;
  'version': string;
  'api': {
    'commands': OHCommand[];
    'languages': OHLanguageObject[];
    'services': OHService[];
  };
  'plugins': {
    'emailSender': {
      'authKey': string;
      'url': string;
    }
  };
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
  type: string;
  termsURL: string;
  dataStoragePolicy: string;
  homepageURL: string;
  logoURL: string;
}

