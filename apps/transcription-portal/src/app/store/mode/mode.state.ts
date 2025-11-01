import { EntityState } from '@ngrx/entity';
import { TaskState } from '../task';

export interface Mode<O extends object> {
  name: string;
  options: O;
  tasks: TaskState;
}

export interface ModeState extends EntityState<Mode<any>> {
  currentMode: 'annotation' | 'summarization';
}

export interface AnnotationModeOptions {}
export interface SummarizationModeOptions {}

export interface AnnotationModeState extends Mode<AnnotationModeOptions> {
  options: AnnotationModeOptions;
}

export interface SummarizationModeState extends Mode<AnnotationModeOptions> {
  options: SummarizationModeOptions;
}
