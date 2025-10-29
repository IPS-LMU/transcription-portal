import {
  AnnotJSONConverter,
  Converter,
  CTMConverter,
  PartiturConverter,
  PraatTableConverter,
  PraatTextgridConverter,
  SRTConverter,
  TextConverter,
  WebVTTConverter,
} from '@octra/annotation';
import { AudioFormat, WavFormat } from '@octra/web-media';

export class AppInfo {
  public static BUILD: {
    version: string;
    hash: string;
    timestamp: string;
  } = (window as any).BUILD ?? {
    version: '0.0.0',
    hash: '2893u092i349i23904',
    timestamp: new Date().toISOString(),
  };

  static get version(): string {
    return this.BUILD.version;
  }

  static get audioFormats(): AudioFormat[] {
    return this._audioFormats;
  }

  private static _audioFormats: AudioFormat[] = [new WavFormat()];

  private static _converters: ConverterData[] = [
    {
      obj: new CTMConverter(),
      color: 'red',
      tierNameMatches: ['^TRN$', '^OCTRA'],
    },
    {
      obj: new PartiturConverter(),
      color: 'forestgreen',
      tierNameMatches: ['^TRN$', '^OCTRA'],
    },
    {
      obj: new AnnotJSONConverter(),
      color: 'gray',
    },
    {
      obj: new PraatTextgridConverter(),
      color: 'orange',
    },
    {
      obj: new PraatTableConverter(),
      color: 'purple',
      tierNameMatches: ['^TRN$', '^OCTRA', '^S[0-9]+'],
    },
    {
      obj: new TextConverter(),
      color: 'darkblue',
      tierNameMatches: ['^TRN$', '^OCTRA', '^S[0-9]+'],
    },
    {
      obj: new SRTConverter(),
      color: 'pink',
      tierNameMatches: ['^TRN$', '^OCTRA', '^S[0-9]+'],
    },
    {
      obj: new WebVTTConverter(),
      color: 'black',
      tierNameMatches: ['^TRN$', '^OCTRA', '^S[0-9]+'],
    },
  ];

  static get converters(): ConverterData[] {
    return this._converters;
  }
}

export interface ConverterData {
  obj: Converter;
  color: string;
  tierNameMatches?: string[];
}
