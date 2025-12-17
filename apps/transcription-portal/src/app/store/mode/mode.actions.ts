import { SafeUrl } from '@angular/platform-browser';
import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { OHConfiguration } from '../../obj/oh-config';
import { OperationFactory } from '../operation';
import { DefaultUserSettings, TPortalModes } from './mode.state';

export class ModeActions {
  static initModes = createActionGroup({
    source: 'modes/initialize',
    events: {
      do: props<{
        settings: OHConfiguration;
      }>(),
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
      success: props<{
        fileName: string;
        url: string;
      }>(),
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
        }[];
      }>(),
    },
  });

  static changeMode = createActionGroup({
    source: 'modes/change mode',
    events: {
      do: props<{
        mode: TPortalModes;
      }>(),
    },
  });

  static setDefaultSettings = createActionGroup({
    source: 'tasks/set default settings',
    events: {
      do: props<{
        defaultUserSettings: DefaultUserSettings;
      }>(),
    },
  });

  static closeToolLoader = createActionGroup({
    source: 'mode/close tool loader',
    events: {
      do: emptyProps(),
    },
  });
}
