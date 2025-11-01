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
  asrQuotaRetrieved: boolean;

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
    ExternalInformationActions.updateASRQuotaInfo.success,
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
        asr: asrLanguages
          ?.filter((a: { ParameterValue: { Value: string; Description: string; ProvidersOnly?: string[] } }) => a.ParameterValue.Description !== '')
          .map((a: { ParameterValue: { Value: string; Description: string; ProvidersOnly?: string[] } }) => {
            const result: {
              value: string;
              providersOnly?: string[];
              description: string;
            } = {
              value: a.ParameterValue.Value,
              description: a.ParameterValue.Description.replace(/ *\([^)]*\) *$/g, ''),
            };

            const matches = / *\(([^)]*)\) *$/g.exec(a.ParameterValue.Description);

            if (matches) {
              const splitted = matches[1].split('/');
              result.providersOnly = splitted.map((b) => {
                switch (b) {
                  case 'whisp':
                    return 'WhisperX';
                  case 'amber':
                    return 'Amber';
                  case 'google':
                    return 'Google';
                  case 'lst':
                    return 'LST';
                  case 'fraunh':
                    return 'Fraunhofer';
                  case 'uweb':
                    return 'Web';
                  case 'eml':
                    return 'EML';
                  case 'watson':
                    return 'Watson';
                }
                return b;
              });

              const lstIndex = result.providersOnly.indexOf('LST');

              if (lstIndex > -1) {
                if (/^nl/g.exec(a.ParameterValue.Value)) {
                  result.providersOnly[lstIndex] = 'LSTDutch';
                } else if (/^en/g.exec(a.ParameterValue.Value)) {
                  result.providersOnly[lstIndex] = 'LSTEnglish';
                } else {
                  result.providersOnly = [
                    ...result.providersOnly.slice(0, lstIndex - 1),
                    'LSTDutch',
                    'LSTEnglish',
                    ...result.providersOnly.slice(lstIndex),
                  ];
                }
              }
            } else {
              result.providersOnly = undefined;
            }

            // add provider only entries for LSTWhisperX because languages for that service
            // are not retrieved from BASWebservices
            if (['deu-DE', 'nld-NL', 'ita-IT', 'eng-GB'].includes(a.ParameterValue.Value)) {
              result.providersOnly = [...(result.providersOnly ?? []), 'LSTWhisperX'];
            }

            return result;
          }),
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
