import { ServiceProvider } from '@octra/ngx-components';

export interface OHConfiguration {
  name: string;
  version: string;
  api: {
    commands: OHCommand[];
    services: ServiceProvider[];
    asrInfoURL?: string;
    asrQuotaInfoURL?: string;
    basConfigURL?: string;
    octraBackend: {
      url: '';
      key: '';
    };
  };
  plugins: {
    tracking?: {
      active: string;
      matomo: {
        host: string;
        siteID: number;
      };
    };
    maintenance?: {
      active?: boolean;
      outagesURL?: string;
      outageTextURL?: string;
    };
  };
  allowed_browsers: {
    name: string;
    version: string;
  }[];
}

export interface OHCommand {
  name: string;
  calls: string[];
}

export interface ProviderLanguage {
  value: string;
  description: string;
  providersOnly?: string[];
}
