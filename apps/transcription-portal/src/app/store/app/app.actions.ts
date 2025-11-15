import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { AppPropertiesDto } from '@octra/api-types';
import { OHConfiguration } from '../../obj/oh-config';

export class AppActions {
  static initApplication = createActionGroup({
    source: 'app/init',
    events: {
      do: emptyProps(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static initVersionChecker = createActionGroup({
    source: 'app/init version checker',
    events: {
      success: emptyProps(),
    },
  });

  static initConsoleLogger = createActionGroup({
    source: 'app/init console logger',
    events: {
      success: emptyProps(),
    },
  });

  static loadSettings = createActionGroup({
    source: 'app/load settings',
    events: {
      do: emptyProps(),
      success: props<{
        configuration: OHConfiguration;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static showErrorModal = createActionGroup({
    source: 'app/show modal',
    events: {
      do: props<{
        error: string;
        showOKButton?: boolean;
      }>(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static initOctraAPI = createActionGroup({
    source: 'app/init octra api',
    events: {
      do: emptyProps(),
      success: props<{
        serverProperties: AppPropertiesDto;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static changeNotificationEnabled = createActionGroup({
    source: 'app/change notification enabled',
    events: {
      do: props<{
        enabled: boolean;
      }>(),
      success: props<{
        enabled: boolean;
      }>(),
    },
  });

  static changeSidebarWidth = createActionGroup({
    source: 'app/change sidebar width',
    events: {
      do: props<{
        sidebarWidth: number;
      }>(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static changeAccessCode = createActionGroup({
    source: 'app/change access code',
    events: {
      do: props<{
        accessCode: string;
      }>(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });
}
