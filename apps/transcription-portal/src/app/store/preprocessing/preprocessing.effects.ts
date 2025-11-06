import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { exhaustMap, withLatestFrom } from 'rxjs';
import { PreprocessingActions } from './preprocessing.actions';
import { RootState } from '../app';
import { TPortalModes } from '../mode';

@Injectable()
export class PreprocessingEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);

  itemAdded$ = createEffect(() =>
      this.actions$.pipe(
        ofType(PreprocessingActions.addToQueue.do),
        withLatestFrom(this.store),
        exhaustMap(([{mode}, state]: [{mode: TPortalModes}, RootState]) => {
          const preprocessingState = state.modes.entities[mode]!.preprocessor;
          const runnintQueueItems = preprocessingState.ids.map(a => preprocessingState.entities[a])
        })
      )
  );
}
