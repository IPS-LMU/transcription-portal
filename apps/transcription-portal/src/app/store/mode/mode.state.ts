import { EntityState } from '@ngrx/entity';
import { StoreTask } from '../task';
import { StoreTaskDirectory } from '../task-directory';
import { Operation } from '../../obj/operations/operation';

export interface Mode<O extends object> {
  name: string;
  options: O;
  defaultOperations: Operation[];
  tasks: EntityState<StoreTask | StoreTaskDirectory>;
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
