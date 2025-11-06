import { createActionGroup, emptyProps, props } from '@ngrx/store';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { StoreItemTask, StoreItemTaskDirectory } from '../store-item';
import { TPortalModes } from '../mode';

export class PreprocessingActions {
  static addToQueue = createActionGroup({
    source: 'preprocessig/add to queue',
    events: {
      do: props<{
        infoItems: (TPortalFileInfo | TPortalAudioInfo | TPortalDirectoryInfo)[];
        mode: TPortalModes;
      }>()
    },
  });

  static processQueueItem = createActionGroup({
      source: 'preprocessing/process queue item',
      events: {
        do: props<{
          id: number,
          mode: TPortalModes;
        }>(),
        success: props<{
          results: (StoreItemTask | StoreItemTaskDirectory)[],
          mode: TPortalModes;
        }>(),
        fail: props<{
          error: string;
        }>(),
      }
  });

}
