import {
  AnnotJSONConverter,
  Converter,
  CTMConverter,
  PartiturConverter,
  PraatTableConverter,
  PraatTextgridConverter,
  TextConverter
} from './obj/Converters';

declare var ohPortalVersion: string;
declare var ohPortalLastUpdated: string;

export class AppInfo {
  static get converters(): {
    obj: Converter,
    color: string
  }[] {
    return this._converters;
  }

  static get version(): string {
    return this._version;
  }

  public static readonly debugging = false;
  static readonly _version = ohPortalVersion;
  static readonly lastUpdated = ohPortalLastUpdated;

  private static _converters: {
    obj: Converter;
    color: string;
  }[] = [
    {
      obj: new CTMConverter(),
      color: 'red'
    },
    {
      obj: new PartiturConverter(),
      color: 'forestgreen'
    },
    {
      obj: new AnnotJSONConverter(),
      color: 'gray'
    },
    {
      obj: new PraatTextgridConverter(),
      color: 'orange'
    },
    {
      obj: new PraatTableConverter(),
      color: 'purple'
    },
    {
      obj: new TextConverter(),
      color: 'darkblue'
    }
  ];
}
