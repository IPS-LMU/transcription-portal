import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { IDBUserDefaultSettingsItem } from '../../indexedDB';
import { AppSettings } from '../../shared/app.settings';
import { IDBActions } from '../idb/idb.actions';
import {
  ASROperationFactory,
  EmuOperationFactory,
  G2pMausOperationFactory,
  OctraOperationFactory,
  SummarizationOperationFactory,
  TranslationOperationFactory,
  UploadOperationFactory,
} from '../operation';
import { PreprocessingQueueItem } from '../preprocessing';
import { getPreprocessingReducers } from '../preprocessing/preprocessing.reducer';
import { getTaskReducers, StoreItem, TaskStatus } from '../store-item';
import { ModeActions } from './mode.actions';
import { Mode, ModeState } from './mode.state';

export const modeAdapter: EntityAdapter<Mode<any>> = createEntityAdapter<Mode<any>>({
  selectId: (mode) => mode.name,
  sortComparer: (a: Mode<any>, b: Mode<any>) => {
    return a.name.localeCompare(b.name);
  },
});

export const initialState: ModeState = modeAdapter.getInitialState({
  currentMode: 'annotation',
  counters: {
    storeItem: 1,
    processingQueueItem: 1,
    operation: 1,
  },
  defaultUserSettings: {},
});

export const taskAdapter: EntityAdapter<StoreItem> = createEntityAdapter<StoreItem>({
  selectId: (task) => task.id,
});

export const preprocessingAdapter: EntityAdapter<PreprocessingQueueItem> = createEntityAdapter<PreprocessingQueueItem>({
  selectId: (item) => item.id,
});

export const modeReducer = createReducer(
  initialState,
  on(IDBActions.initIDB.loaded, (state: ModeState, { userSettings, intern }): ModeState => {
    const defaultUserSettings = userSettings.find((a: IDBUserDefaultSettingsItem) => a.name === 'defaultUserSettings')?.value;

    if (defaultUserSettings) {
      const lang =
        defaultUserSettings.asrLanguage && defaultUserSettings.asrProvider
          ? AppSettings.getLanguageByCode(defaultUserSettings.asrLanguage, defaultUserSettings.asrProvider)
          : undefined;

      if (lang) {
        state = {
          ...state,
          defaultUserSettings: {
            ...state.defaultUserSettings,
            selectedASRLanguage: defaultUserSettings.asrLanguage,
            selectedMausLanguage: defaultUserSettings.mausLanguage,
            selectedASRProvider: AppSettings.getServiceInformation(defaultUserSettings.asrProvider),
            isDiarizationEnabled: defaultUserSettings.diarization ?? false,
            diarizationSpeakers: defaultUserSettings.diarizationSpeakers,
            selectedSummarizationProvider: defaultUserSettings.getServiceInformation(defaultUserSettings.summarizationProvider),
            selectedTranslationLanguage: defaultUserSettings.translationLanguage,
            selectedSummarizationNumberOfWords: defaultUserSettings.summarizationWordLimit,
          },
        };
      }
    }

    return {
      ...state,
      counters: {
        ...state.counters,
        operation: intern.find((a) => a.name === 'operationCounter')?.value ?? 1,
        storeItem: intern.find((a) => a.name === 'taskCounter')?.value ?? 1,
      },
    };
  }),
  on(ModeActions.initModes.do, (state: ModeState, { settings }): ModeState => {
    return modeAdapter.addMany(
      [
        {
          name: 'annotation',
          options: {},
          items: taskAdapter.getInitialState({ allSelected: false }),
          defaultOperations: [
            {
              factory: new UploadOperationFactory(settings.api.commands.find((a) => a.name === 'Upload')!.calls),
              enabled: true,
            },
            {
              factory: new ASROperationFactory(settings.api.commands.find((a) => a.name === 'ASR')!.calls),
              enabled: true,
            },
            {
              factory: new OctraOperationFactory(settings.api.commands.find((a) => a.name === 'OCTRA')!.calls),
              enabled: true,
            },
            {
              factory: new G2pMausOperationFactory(settings.api.commands.find((a) => a.name === 'MAUS')!.calls),
              enabled: true,
            },
            {
              factory: new EmuOperationFactory(settings.api.commands.find((a) => a.name === 'Emu WebApp')!.calls),
              enabled: true,
            },
          ],
          overallState: 'not started',
          status: TaskStatus.READY,
          preprocessor: preprocessingAdapter.getInitialState(),
          statistics: {
            queued: 0,
            waiting: 0,
            running: 0,
            finished: 0,
            errors: 0,
          },
        },
        {
          name: 'summarization',
          options: {},
          items: taskAdapter.getInitialState({ allSelected: false }),
          defaultOperations: [
            {
              factory: new UploadOperationFactory(settings.api.commands.find((a) => a.name === 'Upload')!.calls),
              enabled: true,
            },
            {
              factory: new ASROperationFactory(settings.api.commands.find((a) => a.name === 'ASR')!.calls),
              enabled: true,
            },
            {
              factory: new OctraOperationFactory(settings.api.commands.find((a) => a.name === 'OCTRA')!.calls),
              enabled: true,
            },
            {
              factory: new SummarizationOperationFactory(settings.api.commands.find((a) => a.name === 'Summarization')?.calls ?? []),
              enabled: true,
            },
            {
              factory: new TranslationOperationFactory(settings.api.commands.find((a) => a.name === 'Translation')?.calls ?? []),
              enabled: true,
            },
          ],
          overallState: 'not started',
          status: TaskStatus.READY,
          preprocessor: preprocessingAdapter.getInitialState(),
          statistics: {
            queued: 0,
            waiting: 0,
            running: 0,
            finished: 0,
            errors: 0,
          },
        },
      ],
      state,
    );
  }),
  on(ModeActions.setDefaultOperationEnabled.do, (state: ModeState, { name, enabled }): ModeState => {
    const defaultOperations = state.entities[state.currentMode]!.defaultOperations;
    const operations = {
      Upload: {
        ...defaultOperations.find((a) => a.factory.name === 'Upload')!,
      },
      ASR: {
        ...defaultOperations.find((a) => a.factory.name === 'ASR')!,
      },
      OCTRA: {
        ...defaultOperations.find((a) => a.factory.name === 'OCTRA')!,
      },
      MAUS: {
        ...defaultOperations.find((a) => a.factory.name === 'MAUS')!,
      },
      'Emu WebApp': {
        ...defaultOperations.find((a) => a.factory.name === 'Emu WebApp')!,
      },
      Summarization: {
        ...defaultOperations.find((a) => a.factory.name === 'Summarization')!,
      },
      Translation: {
        ...defaultOperations.find((a) => a.factory.name === 'Translation')!,
      },
    };

    if (state.currentMode === 'annotation') {
      if (name === 'ASR' && enabled === false) {
        operations.OCTRA.enabled = true;
      } else if (name === 'OCTRA' && enabled === false) {
        operations.ASR.enabled = true;
      }

      if (['MAUS', 'Emu WebApp'].includes(name)) {
        operations.MAUS.enabled = enabled;
        operations['Emu WebApp'].enabled = enabled;
      }
    }

    (operations as any)[name].enabled = enabled;

    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          defaultOperations:
            state.currentMode === 'annotation'
              ? [operations.Upload, operations.ASR, operations.OCTRA, operations.MAUS, operations['Emu WebApp']]
              : [operations.Upload, operations.ASR, operations.OCTRA, operations.Summarization, operations.Translation],
        },
      },
      state,
    );
  }),
  on(
    ModeActions.changeMode.do,
    (state: ModeState, { mode }): ModeState => ({
      ...state,
      currentMode: mode,
    }),
  ),
  on(
    ModeActions.setDefaultSettings.do,
    (state: ModeState, { defaultUserSettings }): ModeState => ({
      ...state,
      defaultUserSettings,
    }),
  ),
  ...getTaskReducers(modeAdapter, taskAdapter),
  ...getPreprocessingReducers(modeAdapter, preprocessingAdapter),
);
