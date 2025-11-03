import { EntityAdapter } from '@ngrx/entity';
import { AudioFileInfoSerialized, FileInfoSerialized } from '@octra/web-media';
import { IDBFolderItem, IDBTaskItem } from '../../indexedDB';
import { IOperation } from '../../obj/operations/operation';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { convertIDBOperationToStoreOperation } from '../operation/operation.functions';
import { StoreTaskDirectory } from '../task-directory';
import { StoreTask } from './task';

export function convertIDBTaskToStoreTask(
  entry: IDBTaskItem | IDBFolderItem,
  taskAdapter: EntityAdapter<StoreTask | StoreTaskDirectory>,
  directoryID?: number,
): StoreTask | StoreTaskDirectory {
  if (entry.type === 'task') {
    return {
      id: entry.id,
      type: 'task',
      mouseOver: false,
      stopRequested: false,
      files: entry.files.map((a) => convertIDBFileToStoreFile(a)),
      operations: entry.operations.map((a: IOperation, i: number) => convertIDBOperationToStoreOperation(a, entry.id)),
      directoryID: directoryID,
      status: entry.state,
    } as StoreTask;
  } else {
    const result = {
      id: entry.id,
      type: 'folder',
      path: entry.path,
      folderName: TPortalDirectoryInfo.extractFolderName(entry.path) ?? `Folder ${entry.id}`,
      entries: taskAdapter.getInitialState(),
    };
    result.entries = taskAdapter.addMany(
      entry.entries?.map((a) => convertIDBTaskToStoreTask(a, taskAdapter, entry.id)),
      result.entries,
    );

    return result as StoreTaskDirectory;
  }
}

export function convertIDBFileToStoreFile(file: FileInfoSerialized | AudioFileInfoSerialized) {
  if (file.fullname.indexOf('wav') > 0) {
    const info = new TPortalAudioInfo(
      file.fullname,
      file.type,
      file.size,
      (file as AudioFileInfoSerialized).sampleRate,
      (file as AudioFileInfoSerialized).duration,
      (file as AudioFileInfoSerialized).channels,
      (file as AudioFileInfoSerialized).bitsPerSecond,
    );
    info.attributes = { ...file.attributes };
    info.hash = file.hash;
    return info;
  } else {
    return TPortalFileInfo.fromAny<TPortalFileInfoAttributes>(file) as TPortalFileInfo;
  }
}
