import { createActionGroup, props } from '@ngrx/store';
import { IFile } from '@octra/annotation';
import { DirectoryInfo, FileInfo } from '@octra/web-media';
import { TPortalModes } from '../mode';
import { StoreAudioFile, StoreFile, StoreFileDirectory } from '../store-item';

export class PreprocessingActions {
  static addToQueue = createActionGroup({
    source: 'preprocessig/add to queue',
    events: {
      do: props<{
        infoItems: (FileInfo | DirectoryInfo<any>)[];
      }>(),
      filter: props<{
        mode: TPortalModes;
        infoItems: (FileInfo | DirectoryInfo<any>)[];
      }>(),
      checkFiltered: props<{
        mode: TPortalModes;
        unsupportedFiles: IFile[];
        filteredItems: (StoreFile | StoreFileDirectory)[];
      }>(),
    },
  });

  static processQueueItem = createActionGroup({
    source: 'preprocessing/process queue item',
    events: {
      next: props<{
        mode: TPortalModes;
      }>(),
      do: props<{
        id: number;
        mode: TPortalModes;
      }>(),
      success: props<{
        id: number;
        mode: TPortalModes;
        results: (StoreFile | StoreAudioFile | StoreFileDirectory)[];
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });
}
