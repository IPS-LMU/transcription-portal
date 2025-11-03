import { EntityState } from '@ngrx/entity';
import { ServiceProvider } from '@octra/ngx-components';
import { OperationFactory } from '../operation';
import { StoreTask, TaskStatus } from '../task';
import { StoreTaskDirectory } from '../task-directory';

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
  tasks: EntityState<StoreTask | StoreTaskDirectory>;
  newFiles?: boolean;
  overallState: 'processing' | 'waiting' | 'stopped' | 'not started';
  status: TaskStatus;
  preprocessor: any;
  selectedRows: Set<number>;
  allSelected: boolean;
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
