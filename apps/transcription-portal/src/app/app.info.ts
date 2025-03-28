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
import { environment } from '../environments/environment';

declare var ohPortalVersion: string;
declare var ohPortalLastUpdated: string;

export class AppInfo {
  public static readonly debugging = environment.development;
  static readonly _version = ohPortalVersion;
  static readonly lastUpdated = ohPortalLastUpdated;

  static get version(): string {
    return this._version;
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
      tierNameMatches: ['^TRN$', '^OCTRA'],
    },
    {
      obj: new TextConverter(),
      color: 'darkblue',
      tierNameMatches: ['^TRN$', '^OCTRA'],
    },
    {
      obj: new SRTConverter(),
      color: 'pink',
      tierNameMatches: ['^TRN$', '^OCTRA'],
    },
    {
      obj: new WebVTTConverter(),
      color: 'black',
      tierNameMatches: ['^TRN$', '^OCTRA'],
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
