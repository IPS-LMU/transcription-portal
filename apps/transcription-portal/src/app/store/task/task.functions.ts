import { EntityAdapter } from '@ngrx/entity';
import { AudioFileInfoSerialized, FileInfoSerialized } from '@octra/web-media';
import { IDBFolderItem, IDBTaskItem } from '../../indexedDB';
import { IOperation, Operation } from '../../obj/operations/operation';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { convertIDBOperationToStoreOperation } from '../operation/operation.functions';
import { StoreTaskDirectory } from '../task-directory';
import { StoreTask } from './task';

export function convertIDBTaskToStoreTask(
  entry: IDBTaskItem | IDBFolderItem,
  defaultOperations: Operation[],
  taskAdapter: EntityAdapter<StoreTask | StoreTaskDirectory>,
  directoryID?: number,
): StoreTask | StoreTaskDirectory {
  if (entry.type === 'task') {
    return {
      id: entry.id,
      mouseOver: false,
      stopRequested: false,
      files: entry.files.map((a) => convertIDBFileToStoreFile(a)),
      operations: entry.operations.map((a: IOperation, i: number) => convertIDBOperationToStoreOperation(a, entry.id, defaultOperations[i])),
      directoryID: directoryID,
      status: entry.state,
    };
  } else {
    const result = {
      id: entry.id,
      path: entry.path,
      folderName: TPortalDirectoryInfo.extractFolderName(entry.path) ?? `Folder ${entry.id}`,
      entries: taskAdapter.getInitialState(),
    };
    result.entries = taskAdapter.addMany(
      entry.entries?.map((a) => convertIDBTaskToStoreTask(a, defaultOperations, taskAdapter, entry.id)),
      result.entries,
    );

    return result;
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
