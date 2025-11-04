import { EntityState } from '@ngrx/entity';
import { ServiceProvider } from '@octra/ngx-components';
import { OperationFactory } from '../operation';
import { StoreItemsState, TaskStatus } from '../store-item';

export interface ModeStatistics {
  queued: number;
  waiting: number;
  running: number;
  finished: number;
  errors: number;
}

export interface Mode<O extends object> {
  name: string;
  options: O;
  defaultOperations: OperationFactory<any>[];
  items: StoreItemsState;
  newFiles?: boolean;
  overallState: 'processing' | 'waiting' | 'stopped' | 'not started';
  status: TaskStatus;
  preprocessor: any;
  statistics: ModeStatistics;
}

export interface ModeState extends EntityState<Mode<any>> {
  currentMode: 'annotation' | 'summarization';
  defaultUserSettings: {
    selectedASRLanguage?: string;
    selectedMausLanguage?: string;
    selectedTranslationLanguage?: string;
    selectedASRProvider?: ServiceProvider;
    selectedSummarizationProvider?: ServiceProvider;
    selectedSummarizationNumberOfWords?: number;
    isDiarizationEnabled?: boolean;
    diarizationSpeakers?: number;
  };
}

export interface AnnotationModeOptions {}
export interface SummarizationModeOptions {}

export interface AnnotationModeState extends Mode<AnnotationModeOptions> {
  options: AnnotationModeOptions;
}

export interface SummarizationModeState extends Mode<AnnotationModeOptions> {
  options: SummarizationModeOptions;
}
