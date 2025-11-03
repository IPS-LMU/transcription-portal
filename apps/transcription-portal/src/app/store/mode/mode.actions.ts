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

  static selectRows = createActionGroup({
    source: 'modes/current mode/select rows',
    events: {
      do: props<{
        rowIndexes: number[];
      }>()
    }
  });

  static deselectRows = createActionGroup({
      source: 'modes/current mode/deselect rows',
      events: {
        do: props<{
          rowIndexes: number[];
        }>()
      }
  });

  static setSelectedRows = createActionGroup({
    source: 'modes/current mode/set selected rows',
    events: {
      do: props<{
        rowIndexes: number[];
      }>()
    }
  });

}
