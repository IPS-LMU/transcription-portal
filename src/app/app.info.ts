import {
  AnnotJSONConverter,
  Converter,
  CTMConverter,
  PartiturConverter,
  PraatTableConverter,
  PraatTextgridConverter, TextConverter
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

  private static _version = '1.0.2';
  public static readonly lastUpdated = '2018-06-22 9:00';

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
