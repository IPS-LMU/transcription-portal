import { EntityState } from '@ngrx/entity';
import { StoreTask } from '../task';
import { StoreTaskDirectory } from '../task-directory';
import { Operation } from '../../obj/operations/operation';
import { ServiceProvider } from '@octra/ngx-components';

export interface Mode<O extends object> {
  name: string;
  options: O;
  defaultOperations: Operation[];
  tasks: EntityState<StoreTask | StoreTaskDirectory>;
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
