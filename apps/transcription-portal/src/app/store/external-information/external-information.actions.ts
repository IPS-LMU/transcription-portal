import { createActionGroup, emptyProps, props } from '@ngrx/store';

export interface ASRQuotaInfo {
  asrName: string;
  monthlyQuota?: number;
  usedQuota?: number;
}

export interface ASRInfo {
  name?: string;
  maxSignalDuration?: number;
  maxSignalSize?: number;
  quotaPerMonth?: number;
  termsURL?: string;
  dataStoragePolicy?: string;
  knownIssues?: string;
}

export class ExternalInformationActions {
  static loadExternInformation = createActionGroup({
    source: 'external information/load external information',
    events: {
      do: emptyProps(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static updateASRQuotaInfo = createActionGroup({
    source: 'external information/update asr quota',
    events: {
      do: emptyProps(),
      success: props<{
        asrQuotaInfo: ASRQuotaInfo[];
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static updateASRInfo = createActionGroup({
    source: 'external information/update asr info',
    events: {
      do: emptyProps(),
      success: props<{
        asrInfos: ASRInfo[];
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static getASRLanguages = createActionGroup({
    source: 'external information/get asr languages',
    events: {
      do: emptyProps(),
      success: props<{
        asrLanguages: {
          ParameterValue: { Value: string; Description: string };
        }[];
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static getMAUSLanguages = createActionGroup({
    source: 'external information/get maus languages',
    events: {
      do: emptyProps(),
      success: props<{
        mausLanguages: {
          ParameterValue: { Value: string; Description: string };
        }[];
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });
}
