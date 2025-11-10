import { EntityAdapter } from '@ngrx/entity';
import { ServiceProvider } from '@octra/ngx-components';
import { AudioFileInfoSerialized, AudioInfo, DirectoryInfo, FileInfo, FileInfoSerialized, readFileContents } from '@octra/web-media';
import { IDBFolderItem, IDBOperation, IDBTaskItem } from '../../indexedDB';
import { IOperation } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { taskAdapter } from '../mode';
import { OperationFactory, StoreTaskOperation, StoreTaskOperationProcessingRound } from '../operation';
import { convertIDBOperationToStoreOperation } from '../operation/operation.functions';
import { StoreAudioFile, StoreFile, StoreFileDirectory, StoreItem, StoreItemTask, StoreItemTaskDirectory } from './store-item';
import { StoreItemsState } from './store-items-state';

export function convertIDBTaskToStoreTask(
  entry: IDBTaskItem | IDBFolderItem,
  taskAdapter: EntityAdapter<StoreItem>,
  defaultOperations: {
    factory: OperationFactory;
    enabled: boolean;
  }[],
  directoryID?: number,
): StoreItem {
  if (entry.type === 'task') {
    return {
      id: entry.id,
      type: 'task',
      stopRequested: false,
      files: entry.files.map((a) => convertIDBFileToStoreFile(a)),
      operations: entry.operations.map((a: IDBOperation, i: number) => convertIDBOperationToStoreOperation(a, entry, defaultOperations)),
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
      entry.entries?.map((a) => convertIDBTaskToStoreTask(a, taskAdapter, defaultOperations)),
      result.entries,
    );

    return result as StoreItemTaskDirectory;
  }
}

export function convertIDBFileToStoreFile(a: FileInfoSerialized | AudioFileInfoSerialized): StoreFile | StoreAudioFile {
  const result: StoreFile | StoreAudioFile = {
    attributes: a.attributes,
    content: a.content,
    hash: a.hash!,
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

export function updateTaskFilesWithSameFile(
  addedStoreFileOrDirectory: StoreFile | StoreAudioFile | StoreFileDirectory,
  itemsState: StoreItemsState,
  adapter: EntityAdapter<StoreItem>,
  counters: {
    storeItem: number;
    operation: number;
    processingQueueItem: number;
  },
  defaultOperations: {
    factory: OperationFactory<any>;
    enabled: boolean;
  }[],
  currentModeOptions: {
    selectedASRLanguage?: string;
    selectedMausLanguage?: string;
    selectedTranslationLanguage?: string;
    selectedASRProvider?: ServiceProvider;
    selectedSummarizationProvider?: ServiceProvider;
    selectedSummarizationNumberOfWords?: number;
    isDiarizationEnabled?: boolean;
    diarizationSpeakers?: number;
  },
): {
  state: StoreItemsState;
  counters: {
    storeItem: number;
    operation: number;
    processingQueueItem: number;
  };
} {
  const result: {
    state: StoreItemsState;
    counters: {
      storeItem: number;
      operation: number;
      processingQueueItem: number;
    };
  } = {
    state: itemsState,
    counters: { ...counters },
  };

  let someThingFound = false;

  for (const itemID of itemsState.ids) {
    if (addedStoreFileOrDirectory.type !== 'folder' && itemsState.entities[itemID]?.type === 'task') {
      const addedFile = addedStoreFileOrDirectory as StoreFile;
      const task = itemsState.entities[itemID] as StoreItemTask;

      if ([TaskStatus.QUEUED, TaskStatus.PENDING].includes(task.status) || task.operations[0].lastRound?.lastResult?.available == false) {
        // first try to replace same file in a task
        let somethingFoundInFiles = false;
        for (let i = 0; i < task.files.length; i++) {
          const file = task.files[i];

          if (file.attributes.originalFileName === addedFile.attributes.originalFileName && file.hash === addedFile.hash) {
            somethingFoundInFiles = true;
            someThingFound = true;
            // replace blob file
            result.state = adapter.updateOne(
              {
                id: task.id,
                changes: {
                  files: [
                    ...task.files.slice(0, i),
                    {
                      ...task.files[i],
                      blob: addedFile.blob,
                      available: true,
                      online: false,
                    },
                    ...task.files.slice(i + 1),
                  ],
                },
              },
              result.state,
            );
          }
        }

        // check if there is an audio or file with a matching name
        if (!somethingFoundInFiles && task.files.length === 1) {
          const firstFile = task.files[0];
          const firstFileName = FileInfo.extractFileName(firstFile.attributes.originalFileName);
          const storeFileName = FileInfo.extractFileName(addedStoreFileOrDirectory.attributes.originalFileName);

          if (firstFile.type !== addedStoreFileOrDirectory.type && firstFileName.name === storeFileName.name) {
            if (firstFile.type.includes('audio') || addedStoreFileOrDirectory.type.includes('audio')) {
              someThingFound = true;
              const files = firstFile.type.includes('audio') ? [...task.files, addedFile] : [addedFile, ...task.files];
              result.state = adapter.updateOne(
                {
                  id: task.id,
                  changes: {
                    files,
                  },
                },
                result.state,
              );
            }
          }
        }
      }
    } else {
      const dir = itemsState.entities[itemID] as StoreItemTaskDirectory;
      // TODO implement
    }
  }

  if (!someThingFound) {
    if (addedStoreFileOrDirectory.type !== 'folder') {
      // add file to a new task
      const addedFile = addedStoreFileOrDirectory as StoreFile;
      const newTaskID = result.counters.storeItem;
      const operations = createOperationsByDefaultOperations(defaultOperations, newTaskID, result.counters, currentModeOptions);

      const newStoreItem: StoreItemTask = {
        files: [addedFile],
        id: newTaskID,
        operations,
        status: TaskStatus.QUEUED,
        type: 'task',
      };

      result.state = adapter.addOne(newStoreItem, result.state);
      result.counters.storeItem = result.counters.storeItem + 1;
    } else {
      const addedFolder = addedStoreFileOrDirectory as StoreFileDirectory;
      let folderIDCounter = result.counters.storeItem;
      let newStoreItemCounter = folderIDCounter + 1;
      const newStoreItem: StoreItemTaskDirectory = {
        folderName: addedFolder.name,
        id: folderIDCounter,
        path: addedFolder.path,
        size: addedFolder.size,
        type: 'folder',
        entries: taskAdapter.addMany(
          addedFolder.entries?.map((storeFileOrDir) => {
            if (storeFileOrDir.type === 'folder') {
              const di = storeFileOrDir as StoreFileDirectory;
              const d: StoreItemTaskDirectory = {
                entries: { ...taskAdapter.getInitialState(), allSelected: false },
                folderName: di.name,
                id: folderIDCounter++,
                path: di.path,
                size: di.size,
                type: 'folder',
              };
              newStoreItemCounter++;
              return d;
            } else {
              // file
              const fi = storeFileOrDir as StoreFile;
              const f: StoreItemTask = {
                directoryID: folderIDCounter,
                files: [fi],
                id: newStoreItemCounter,
                operations: createOperationsByDefaultOperations(defaultOperations, newStoreItemCounter, result.counters, currentModeOptions),
                status: TaskStatus.QUEUED,
                type: 'task',
              };
              newStoreItemCounter++;
              return f;
            }
          }) ?? [],
          {
            ...taskAdapter.getInitialState(),
            allSelected: false,
          },
        ),
      };
      result.state = adapter.addOne(newStoreItem, result.state);
      result.counters.storeItem = newStoreItemCounter;
    }
  }

  return result;
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
      hash: audio.hash!,
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
      hash: f.hash!,
      online: f.online,
      size: f.size,
      type: f.type,
      url: f.url,
    };
    return result;
  }
}

export function convertStoreAudioFileToAudioInfo(audioFile: StoreAudioFile) {
  const audioInfo = new AudioInfo(
    audioFile.name,
    audioFile.type,
    audioFile.size,
    audioFile.sampleRate,
    audioFile.duration,
    audioFile.channels,
    audioFile.bitrate,
    audioFile.audioBufferInfo,
  );
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

export function createOperationsByDefaultOperations(
  defaultOperations: {
    factory: OperationFactory<any>;
    enabled: boolean;
  }[],
  taskID: number,
  counters: {
    storeItem: number;
    operation: number;
    processingQueueItem: number;
  },
  currentModeOptions: {
    selectedASRLanguage?: string;
    selectedMausLanguage?: string;
    selectedTranslationLanguage?: string;
    selectedASRProvider?: ServiceProvider;
    selectedSummarizationProvider?: ServiceProvider;
    selectedSummarizationNumberOfWords?: number;
    isDiarizationEnabled?: boolean;
    diarizationSpeakers?: number;
  },
): StoreTaskOperation[] {
  return defaultOperations.map((defaultOperation) => {
    let operation = defaultOperation.factory.create(counters.operation, taskID, [
      new StoreTaskOperationProcessingRound({
        status: defaultOperation.enabled ? TaskStatus.PENDING : TaskStatus.SKIPPED,
      }),
    ]);
    operation.enabled = defaultOperation.enabled;
    operation = defaultOperation.factory.applyTaskOptions(
      {
        asr: {
          provider: currentModeOptions.selectedASRProvider?.provider,
          language: currentModeOptions.selectedASRLanguage,
          diarization: {
            enabled: currentModeOptions.isDiarizationEnabled,
            speakers: currentModeOptions.diarizationSpeakers,
          },
        },
        maus: {
          language: currentModeOptions.selectedMausLanguage,
        },
        translation: {
          language: currentModeOptions.selectedTranslationLanguage,
        },
        summarization: {
          provider: currentModeOptions.selectedSummarizationProvider?.provider,
          numberOfWords: currentModeOptions.selectedSummarizationNumberOfWords,
        },
      },
      operation,
    );

    counters.operation++;
    return operation;
  });
}
