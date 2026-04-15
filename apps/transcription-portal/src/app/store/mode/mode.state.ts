import { EntityState } from '@ngrx/entity';
import { ServiceProvider } from '@octra/ngx-components';
import { OperationFactory, StoreTaskOperation, ToolOperationFactory } from '../operation';
import { PreprocessingState } from '../preprocessing/preprocessing.state';
import { StoreAudioFile, StoreFile, StoreItemsState, TaskStatus } from '../store-item';

export type TPortalModes = 'annotation' | 'summarization';

export type OverallState = 'processing' | 'waiting' | 'stopped' | 'not started';
export interface ModeStatistics {
  queued: number;
  waiting: number;
  running: number;
  finished: number;
  errors: number;
}

export interface ParsedOpenedTool {
  operation: StoreTaskOperation<any, StoreTaskOperation<any, any>> | undefined;
  factory: ToolOperationFactory;
  language: string;
  audioFile: StoreAudioFile;
  transcript?: StoreFile;
}

export interface DefaultUserSettings {
  selectedASRLanguage?: string;
  selectedMausLanguage?: string;
  selectedTranslationLanguage?: string;
  selectedASRProvider?: ServiceProvider;
  selectedSummarizationProvider?: ServiceProvider;
  selectedSummarizationNumberOfWords?: number;
  isDiarizationEnabled?: boolean;
  diarizationSpeakers?: number;
}

export interface Mode<O extends object> {
  name: string;
  options: O;
  defaultOperations: {
    factory: OperationFactory<any>;
    enabled: boolean;
  }[];
  items: StoreItemsState;
  allSelected?: boolean;
  openedTool?: {
    taskID: number;
    operationID: number;
    operationName: string;
    audioFile: StoreAudioFile;
    transcript?: StoreFile;
    language: string;
  };
  newFiles?: boolean;
  overallState: OverallState;
  overallStateLabel?: string;
  status: TaskStatus;
  preprocessor: PreprocessingState;
  protocol?: {
    url: string;
    fileName: string;
  };
  statistics: ModeStatistics;
  gui: {
    toolOpenStatus: 'init' | 'opened' | 'closed';
  };
}

export interface ModeState extends EntityState<Mode<any>> {
  currentMode: TPortalModes;
  counters: {
    storeItem: number;
    operation: number;
    processingQueueItem: number;
  };

  defaultUserSettings: DefaultUserSettings;
}

export interface AnnotationModeOptions {}
export interface SummarizationModeOptions {}

export interface AnnotationModeState extends Mode<AnnotationModeOptions> {
  options: AnnotationModeOptions;
}

export interface SummarizationModeState extends Mode<AnnotationModeOptions> {
  options: SummarizationModeOptions;
}
