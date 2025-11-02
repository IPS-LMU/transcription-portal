import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { ASROperation } from '../../obj/operations/asr-operation';
import { EmuOperation } from '../../obj/operations/emu-operation';
import { G2pMausOperation } from '../../obj/operations/g2p-maus-operation';
import { OCTRAOperation } from '../../obj/operations/octra-operation';
import { SummarizationOperation } from '../../obj/operations/summarization-operation';
import { TranslationOperation } from '../../obj/operations/translation-operation';
import { UploadOperation } from '../../obj/operations/upload-operation';
import { AppSettings } from '../../shared/app.settings';
import { getTaskReducers, StoreTask } from '../task';
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
});

export const taskAdapter: EntityAdapter<StoreTask | StoreTaskDirectory> = createEntityAdapter<StoreTask | StoreTaskDirectory>({
  selectId: (task) => task.id,
});

export const modeReducer = createReducer(
  initialState,
  on(ModeActions.initModes.do, (state: ModeState): ModeState => {
    return modeAdapter.addMany(
      [
        {
          name: 'annotation',
          options: {},
          tasks: taskAdapter.getInitialState(),
          defaultOperations: [
            new UploadOperation('Upload', AppSettings.configuration.api.commands[0].calls, 'Upload', 'UL'),
            new ASROperation('ASR', AppSettings.configuration.api.commands[1].calls, 'Speech Recognition', 'ASR'),
            new OCTRAOperation('OCTRA', AppSettings.configuration.api.commands[2].calls, 'Manual Transcription', 'MT'),
            new G2pMausOperation('MAUS', AppSettings.configuration.api.commands[3].calls, 'Word alignment', 'WA'),
            new EmuOperation('Emu WebApp', AppSettings.configuration.api.commands[4].calls, 'Phonetic detail', 'PD'),
          ],
        },
        {
          name: 'summarization',
          options: {},
          tasks: taskAdapter.getInitialState(),
          defaultOperations: [
            new UploadOperation('Upload', AppSettings.configuration.api.commands[0].calls, 'Upload', 'UL'),
            new ASROperation('ASR', AppSettings.configuration.api.commands[1].calls, 'Speech Recognition', 'ASR'),
            new OCTRAOperation('OCTRA', AppSettings.configuration.api.commands[2].calls, 'Manual Transcription', 'MT'),
            new SummarizationOperation('Summarization', [''], 'Summarization', 'SUM'),
            new TranslationOperation('Translation', [''], 'Translation', 'TR'),
          ],
        },
      ],
      state,
    );
  }),
  ...getTaskReducers(modeAdapter, taskAdapter),
);
