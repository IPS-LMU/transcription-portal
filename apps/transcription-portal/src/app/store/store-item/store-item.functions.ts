import { EntityAdapter } from '@ngrx/entity';
import { AudioFileInfoSerialized, AudioInfo, DirectoryInfo, FileInfo, FileInfoSerialized, readFileContents } from '@octra/web-media';
import { IDBFolderItem, IDBTaskItem } from '../../indexedDB';
import { IOperation } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { convertIDBOperationToStoreOperation } from '../operation/operation.functions';
import { StoreAudioFile, StoreFile, StoreFileDirectory, StoreItem, StoreItemTask, StoreItemTaskDirectory } from './store-item';

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
      folderName: extractFolderName(entry.path) ?? `Folder ${entry.id}`,
      entries: taskAdapter.getInitialState(),
    };
    result.entries = taskAdapter.addMany(
      entry.entries?.map((a) => convertIDBTaskToStoreTask(a, taskAdapter, entry.id)),
      result.entries,
    );

    return result as StoreItemTaskDirectory;
  }
}

export function convertIDBFileToStoreFile(a: FileInfoSerialized | AudioFileInfoSerialized): StoreFile | StoreAudioFile {
  const result: StoreFile | StoreAudioFile = {
    attributes: a.attributes,
    content: a.content,
    hash: a.hash,
    online: a.online,
    size: a.size,
    type: a.type,
    url: a.url,
    name: a.fullname,
  };

  if (a.type.includes('audio')) {
    const audio = a as AudioFileInfoSerialized;
    return {
      ...result,
      bitrate: audio.bitsPerSecond,
      sampleRate: audio.sampleRate,
      channels: audio.channels,
      audioBufferInfo: audio.audioBufferInfo,
    };
  }

  return result;
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

export function extractFolderName(path: string): string | undefined {
  if (path !== '') {
    let extensionBegin = path.lastIndexOf('/');
    if (extensionBegin > -1) {
      // split name and extension
      let foldername = path.substring(0, extensionBegin);

      extensionBegin = foldername.lastIndexOf('/');
      if (extensionBegin > -1) {
        foldername = foldername.substring(extensionBegin + 1);
      }

      return foldername;
    } else {
      throw new Error('invalid folder path.');
    }
  }
  return undefined;
}

export async function convertInfoFileItemToStoreFileItem(
  item: FileInfo | AudioInfo | DirectoryInfo<any>,
): Promise<StoreFile | StoreAudioFile | StoreFileDirectory> {
  if (item.type === 'folder') {
    return convertFileInfoDirectoryToStoreFileDirectory(item as DirectoryInfo<any>);
  } else {
    return convertFileInfoToStoreFile(item as FileInfo | AudioInfo);
  }
}

export async function convertFileInfoToStoreFile(file: FileInfo | AudioInfo): Promise<StoreFile | StoreAudioFile> {
  if (file.type.includes('audio')) {
    const audio = file as AudioInfo;
    const result: StoreAudioFile = {
      attributes: audio.attributes,
      audioBufferInfo: audio.audioBufferInfo,
      available: audio.available,
      bitrate: audio.bitrate,
      blob: audio.file,
      channels: audio.channels,
      content: undefined,
      duration: audio.duration,
      name: audio.fullname,
      hash: audio.hash,
      online: audio.online,
      sampleRate: audio.sampleRate,
      size: audio.size,
      type: audio.type,
      url: audio.url,
    };
    return result;
  } else {
    const f = file as FileInfo;
    const result: StoreFile = {
      attributes: f.attributes,
      available: f.available,
      blob: f.file,
      content: f.file ? await readFileContents(f.file, 'text') : undefined,
      name: f.fullname,
      hash: f.hash,
      online: f.online,
      size: f.size,
      type: f.type,
      url: f.url,
    };
    return result;
  }
}

export function convertStoreAudioFileToAudioInfo(audioFile: StoreAudioFile) {
  const audioInfo = new AudioInfo(audioFile.name, audioFile.type, audioFile.size, audioFile.sampleRate, audioFile.duration, audioFile.channels, audioFile.bitrate, audioFile.audioBufferInfo);
  audioInfo.attributes = audioFile.attributes;
  audioInfo.online = audioFile.online ?? false;
  audioInfo.url = audioFile.url;
  audioInfo.hash = audioFile.hash;
  audioInfo.file = audioFile.blob;
  return audioInfo;
}

export async function convertFileInfoDirectoryToStoreFileDirectory(directory: DirectoryInfo<any>): Promise<StoreFileDirectory> {
  const result: StoreFileDirectory = {
    name: directory.name,
    path: directory.path,
    type: 'folder',
    size: directory.size,
    hash: directory.hash,
    attributes: directory.attributes,
    entries: [],
  };

  for (const entry of directory.entries) {
    result.entries!.push(await convertInfoFileItemToStoreFileItem(entry));
  }

  return result;
}
