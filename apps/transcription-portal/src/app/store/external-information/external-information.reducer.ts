import { createReducer, on } from '@ngrx/store';
import { ExternalInformationActions } from './external-information.actions';

export interface ASRLanguage {
  value: string;
  providersOnly?: string[];
  description: string;
}

export interface ExternalInformationState {
  mausLanguagesInitialized: boolean;
  asrLanguagesInitialized: boolean;
  asrInfoRetrieved: boolean;
  asrQuotaRetrieved?: boolean;

  languages: {
    asr: ASRLanguage[];
    maus: ASRLanguage[];
  };
}

const externalInformationInitialState: ExternalInformationState = {
  asrInfoRetrieved: false,
  asrLanguagesInitialized: false,
  asrQuotaRetrieved: false,
  mausLanguagesInitialized: false,

  languages: {
    asr: [],
    maus: [],
  },
};

export const externalInformationReducer = createReducer<ExternalInformationState>(
  externalInformationInitialState,
  on(
    ExternalInformationActions.updateASRInfo.success,
    (state: ExternalInformationState): ExternalInformationState => ({
      ...state,
      asrInfoRetrieved: true,
    }),
  ),
  on(
    ExternalInformationActions.updateASRQuotaInfo.success, ExternalInformationActions.updateASRQuotaInfo.fail,
    (state: ExternalInformationState): ExternalInformationState => ({
      ...state,
      asrQuotaRetrieved: true,
    }),
  ),
  on(
    ExternalInformationActions.getASRLanguages.success,
    (state: ExternalInformationState, { asrLanguages }): ExternalInformationState => ({
      ...state,
      asrLanguagesInitialized: true,
      languages: {
        ...state.languages,
        asr: asrLanguages,
      },
    }),
  ),
  on(
    ExternalInformationActions.getMAUSLanguages.success,
    (state: ExternalInformationState, { mausLanguages }): ExternalInformationState => ({
      ...state,
      mausLanguagesInitialized: true,
      languages: {
        ...state.languages,
        maus: mausLanguages
          .filter(
            (a: { ParameterValue: { Value: string; Description: string; ProvidersOnly?: string[] } }) =>
              a.ParameterValue.Description && a.ParameterValue.Description !== '',
          )
          .map((a: { ParameterValue: { Value: string; Description: string; ProvidersOnly?: string[] } }) => ({
            value: a.ParameterValue.Value,
            description: a.ParameterValue.Description,
            providersOnly: a.ParameterValue.ProvidersOnly,
          })),
      },
    }),
  ),
);
