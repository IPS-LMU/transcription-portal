import { createActionGroup, props } from '@ngrx/store';
import { IFile } from '@octra/annotation';
import { DirectoryInfo, FileInfo } from '@octra/web-media';
import { TPortalDirectoryInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { TPortalModes } from '../mode';
import { StoreItemTask, StoreItemTaskDirectory } from '../store-item';

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
        filteredItems: (TPortalFileInfo | TPortalDirectoryInfo)[];
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
        results: (StoreItemTask | StoreItemTaskDirectory)[];
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });
}
