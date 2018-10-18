export interface OHConfiguration {
  'name': string;
  'version': string;
  'api': {
    'commands': OHCommand[];
    'languages': OHLanguageObject[];
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

