import { EntityAdapter } from '@ngrx/entity';
import { AudioFileInfoSerialized, FileInfoSerialized } from '@octra/web-media';
import { IDBFolderItem, IDBTaskItem } from '../../indexedDB';
import { IOperation } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { convertIDBOperationToStoreOperation } from '../operation/operation.functions';
import { StoreItem, StoreItemTask, StoreItemTaskDirectory } from './store-item';

export function convertIDBTaskToStoreTask(
  entry: IDBTaskItem | IDBFolderItem,
  taskAdapter: EntityAdapter<StoreItem>,
  directoryID?: number,
): StoreItem {
  if (entry.type === 'task') {
    return {
      id: entry.id,
      type: 'task',
      stopRequested: false,
      files: entry.files.map((a) => convertIDBFileToStoreFile(a)),
      operations: entry.operations.map((a: IOperation, i: number) => convertIDBOperationToStoreOperation(a, entry.id)),
      directoryID: directoryID,
      status: entry.state,
    } as StoreItemTask;
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

    return result as StoreItemTaskDirectory;
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

export function getTaskWithHashAndName(hash: string, name: string, entries: StoreItem[]): StoreItemTask | undefined {
  for (const entry of entries) {
    if (entry.type === 'task') {
      const task = entry as StoreItemTask;
      if (!(task.files[0].attributes.originalFileName === null || task.files[0].attributes.originalFileName === undefined)) {
        for (const file of task.files) {
          const cmpHash = file.hash ?? `${file.name}_${file.size}`;

          if (
            cmpHash === hash &&
            file.attributes.originalFileName === name &&
            (task.operations[0].status === TaskStatus.PENDING ||
              task.operations[0].status === TaskStatus.ERROR ||
              !task.operations[0].lastRound?.results.find((a) => a.attributes.originalFileName === name)?.available)
          ) {
            return task;
          }
        }
      } else {
        console.error('could not find originalFilename');
      }
    } else {
      const dir = entry as StoreItemTaskDirectory;
      const entries = dir.entries.ids.map((id) => dir.entries.entities[id]).filter((a) => a !== undefined);
      const found = getTaskWithHashAndName(hash, name, entries);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
}
