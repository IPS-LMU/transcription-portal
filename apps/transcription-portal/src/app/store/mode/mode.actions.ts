import { createActionGroup, emptyProps, props } from '@ngrx/store';

export class ModeActions {
  static initModes = createActionGroup({
      source: 'modes/initialize',
      events: {
        do: emptyProps(),
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

  static updateProtocolURL = createActionGroup({
      source: 'modes/update protocol URL',
      events: {
        do: emptyProps(),
        success: emptyProps(),
        fail: props<{
          error: string;
        }>(),
      }
  });

}
