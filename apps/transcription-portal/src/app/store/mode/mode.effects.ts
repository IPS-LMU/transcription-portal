import { inject, Injectable } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { VersionCheckerService } from '@octra/ngx-components';
import { map } from 'rxjs';
import { ModeActions } from '../mode';

@Injectable()
export class ModeEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  versionChecker = inject(VersionCheckerService);

  initModes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(ModeActions.initModes.do),
      map(() => {
        return ModeActions.initModes.success();
      }),
    ),
  );
}
