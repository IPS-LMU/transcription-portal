import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { IDBUserDefaultSettingsItem } from '../../indexedDB';
import { AppSettings } from '../../shared/app.settings';
import { IDBActions } from '../idb';
import {
  ASROperationFactory,
  EmuOperationFactory,
  G2pMausOperationFactory,
  OctraOperationFactory,
  SummarizationOperationFactory,
  TranslationOperationFactory,
  UploadOperationFactory,
} from '../operation';
import { getTaskReducers, StoreTask, TaskStatus } from '../task';
import { StoreTaskDirectory } from '../task-directory';
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
  defaultUserSettings: {},
});

export const taskAdapter: EntityAdapter<StoreTask | StoreTaskDirectory> = createEntityAdapter<StoreTask | StoreTaskDirectory>({
  selectId: (task) => task.id,
});

export const modeReducer = createReducer(
  initialState,
  on(IDBActions.initIDB.loaded, (state: ModeState, { userSettings }): ModeState => {
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

    return state;
  }),
  on(ModeActions.initModes.do, (state: ModeState): ModeState => {
    return modeAdapter.addMany(
      [
        {
          name: 'annotation',
          options: {},
          tasks: taskAdapter.getInitialState(),
          defaultOperations: [
            new UploadOperationFactory(),
            new ASROperationFactory(),
            new OctraOperationFactory(),
            new G2pMausOperationFactory(),
            new EmuOperationFactory(),
          ],
          overallState: 'not started',
          status: TaskStatus.READY,
          selectedRows: new Set<number>(),
          allSelected: false,
          preprocessor: {},
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
          tasks: taskAdapter.getInitialState(),
          defaultOperations: [
            new UploadOperationFactory(),
            new ASROperationFactory(),
            new OctraOperationFactory(),
            new SummarizationOperationFactory(),
            new TranslationOperationFactory(),
          ],
          overallState: 'not started',
          status: TaskStatus.READY,
          selectedRows: new Set<number>(),
          allSelected: false,
          preprocessor: {},
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
  on(ModeActions.selectRows.do, (state: ModeState, { rowIndexes }): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          selectedRows: new Set([...Array.from(state.entities[state.currentMode]?.selectedRows ?? new Set<number>()), ...rowIndexes]),
        },
      },
      state,
    );
  }),
  on(ModeActions.deselectRows.do, (state: ModeState, { rowIndexes }): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          selectedRows: new Set(
            Array.from(state.entities[state.currentMode]?.selectedRows ?? new Set<number>()).filter((a) => !rowIndexes.includes(a)),
          ),
        },
      },
      state,
    );
  }),
  on(ModeActions.setSelectedRows.do, (state: ModeState, { rowIndexes }): ModeState => {
    return modeAdapter.updateOne(
      {
        id: state.currentMode,
        changes: {
          selectedRows: new Set(rowIndexes),
        },
      },
      state,
    );
  }),
  ...getTaskReducers(modeAdapter, taskAdapter),
);
