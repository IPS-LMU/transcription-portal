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
  on(ModeActions.initModes.do, (state: ModeState): ModeState => {
    return modeAdapter.addMany(
      [
        {
          name: 'annotation',
          options: {},
          items: taskAdapter.getInitialState({ allSelected: false }),
          defaultOperations: [
            new UploadOperationFactory(),
            new ASROperationFactory(),
            new OctraOperationFactory(),
            new G2pMausOperationFactory(),
            new EmuOperationFactory(),
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
            new UploadOperationFactory(),
            new ASROperationFactory(),
            new OctraOperationFactory(),
            new SummarizationOperationFactory(),
            new TranslationOperationFactory(),
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
  ...getTaskReducers(modeAdapter, taskAdapter),
  ...getPreprocessingReducers(modeAdapter, preprocessingAdapter),
);
