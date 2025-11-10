import { EntityState } from '@ngrx/entity';
import { ServiceProvider } from '@octra/ngx-components';
import { OperationFactory } from '../operation';
import { PreprocessingState } from '../preprocessing/preprocessing.state';
import { StoreItemsState, TaskStatus } from '../store-item';

export type TPortalModes = 'annotation' | 'summarization';

export interface ModeStatistics {
  queued: number;
  waiting: number;
  running: number;
  finished: number;
  errors: number;
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
  newFiles?: boolean;
  overallState: 'processing' | 'waiting' | 'stopped' | 'not started';
  status: TaskStatus;
  preprocessor: PreprocessingState;
  statistics: ModeStatistics;
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
