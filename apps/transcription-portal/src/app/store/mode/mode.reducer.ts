import { createEntityAdapter, EntityAdapter } from '@ngrx/entity';
import { createReducer, on } from '@ngrx/store';
import { ModeActions } from './mode.actions';
import { AnnotationModeState, Mode, ModeState, SummarizationModeState } from './mode.state';

export function selectCurrentMode(a: Mode<any>): string {
  return a.name;
}

export function sortModes(a: Mode<any>, b: Mode<any>): number {
  return a.name.localeCompare(b.name);
}

export const adapter: EntityAdapter<Mode<any>> = createEntityAdapter<Mode<any>>({
  selectId: selectCurrentMode,
  sortComparer: sortModes,
});

export const initialState: ModeState = adapter.getInitialState({
  currentMode: 'annotation',
});

export const modeReducer = createReducer(
  initialState,
  on(ModeActions.initModes.do, (state: ModeState): ModeState => {
    return adapter.addMany(
      [
        {
          name: 'annotation',
          options: {},
        } as AnnotationModeState,
        {
          name: 'summarization',
          options: {},
        } as SummarizationModeState,
      ],
      state,
    );
  })
);
