import {
  AnnotJSONConverter,
  Converter,
  CTMConverter,
  PartiturConverter,
  PraatTableConverter,
  PraatTextgridConverter
} from './obj/Converters';

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

  private static _version = '1.0.0';
  public static readonly lastUpdated = '2018-01-24 18:00';

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
    }
  ];
}
