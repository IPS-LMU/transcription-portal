import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { TPortalModes } from './mode.state';
import { OperationFactory } from '../operation';

export class ModeActions {
  static initModes = createActionGroup({
    source: 'modes/initialize',
    events: {
      do: emptyProps(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static updateProtocolURL = createActionGroup({
    source: 'modes/update protocol URL',
    events: {
      do: emptyProps(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static setDefaultOperationEnabled = createActionGroup({
    source: 'modes/set operation enabled',
    events: {
      do: props<{
        name: string;
        enabled: boolean;
      }>(),
      success: props<{
        defaultOptions: {
          factory: OperationFactory;
          enabled: boolean;
        }[]
      }>()
    },
  });

  static changeMode = createActionGroup({
    source: 'modes/change mode',
    events: {
      do: props<{
        mode: TPortalModes;
      }>()
    },
  });
}
