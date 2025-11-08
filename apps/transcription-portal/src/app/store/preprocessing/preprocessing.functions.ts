import { IFile } from '@octra/annotation';
import { AudioFormat, AudioManager, DirectoryInfo, FileInfo, getAudioInfo } from '@octra/web-media';
import { AppInfo } from '../../app.info';
import { calcSHA256FromFile, cryptoSupported } from '../../obj/CryptoHelper';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { readFileAsArray, validTranscript } from '../../obj/functions';
import { TaskStatus } from '../../obj/tasks';
import { Mode } from '../mode';
import { StoreTaskOperationProcessingRound } from '../operation';
import { StoreItemTask, StoreItemTaskDirectory } from '../store-item';
import { PreprocessingQueueItem } from './preprocessing.state';

/*
TODO SPLIT AUDIO
if (audioInfo.channels > 1) {
        const directory = new TPortalDirectoryInfo(path + file.attributes?.originalFileName.replace(/\..+$/g, '') + '_dir/');
        const cutter = new AudioCutter(audioInfo);
        const files: File[] = await cutter.splitChannelsToFiles(file.attributes?.originalFileName ?? '', [0, 1], arrayBuffer);
        if (splitPrompt === 'PENDING') {
          queueItem = {
            ...queueItem,
            status: ProcessingQueueStatus.WAIT_FOR_SPLIT,
          };
        } else if (splitPrompt !== 'ASKED') {
          if (splitPrompt === 'FIRST') {
            files.splice(1, 1);
          } else if (splitPrompt === 'SECOND') {
            files.splice(0, 1);
          }
        }

        const fileInfos: TPortalFileInfo[] = [];

        if (files.length > 1) {
          for (let i = 0; i < files.length; i++) {
            const fileObj = files[i];
            const fileInfo = TPortalFileInfo.fromFileObject(fileObj) as TPortalFileInfo;
            fileInfo.hash = await calcSHA256FromFile(fileObj);
            fileInfo.attributes = {
              originalFileName: `${file.attributes.originalFileName.replace(/\..+$/g, '')}_${i + 1}${file.extension}`,
            };
            fileInfos.push(fileInfo);
          }
          directory.addEntries(fileInfos);
          const result = await processDirectoryInfo(directory, queueItem, preprocessingState, splitPrompt);
          return result;
        } else {
          return processFileInfo(TPortalFileInfo.fromFileObject(files[0]) as TPortalFileInfo, path, queueItem, preprocessingState, splitPrompt);
        }
      }

 */

/* TODO move this to reducer after file added
const foundOldFileInTask = getTaskWithHashAndName(
file.hash!,
file.attributes.originalFileName,
modeState.items.ids.map((id) => modeState.items.entities[id]).filter((a) => a !== undefined),
);
// found file in another task
const index = foundOldFileInTask.files.findIndex(
  (a) => a.attributes.originalFileName === file.attributes.originalFileName && a.hash === file.hash,
);
if (index > -1) {
  const copy = file.clone();
  foundOldFileInTask.setFileObj(index, copy);
  foundOldFileInTask.operations[0].changeState(TaskStatus.PENDING);
}

 */

export function cleanUpInputArray(entries: (FileInfo | DirectoryInfo<any>)[]): {
  unsupportedFiles: IFile[];
  filteredItems: (FileInfo | DirectoryInfo<any>)[];
} {
  const result: {
    unsupportedFiles: IFile[];
    filteredItems: (FileInfo | DirectoryInfo<any>)[];
  } = {
    unsupportedFiles: [],
    filteredItems: [],
  };

  for (const entry of entries) {
    if (entry instanceof FileInfo) {
      const file = entry as TPortalFileInfo;
      const format: AudioFormat | undefined = AudioManager.getFileFormat(file.extension, AppInfo.audioFormats);

      if (format || validTranscript(file.extension)) {
        result.filteredItems.push(file);
      } else {
        result.unsupportedFiles.push({
          content: '',
          encoding: '',
          name: file.name,
          type: file.type,
        });
      }
    } else {
      const directory = entry as TPortalDirectoryInfo;

      const dir = directory.clone() as TPortalDirectoryInfo;

      dir.entries = dir.entries.filter((a: any) => {
        const format: AudioFormat | undefined = AudioManager.getFileFormat(a.extension, AppInfo.audioFormats);
        return a instanceof FileInfo && (format || validTranscript(a.extension));
      });
      const rest = directory.entries.filter((a: any) => {
        return a.type === 'folder';
      }) as TPortalDirectoryInfo[];

      if (dir.entries.length > 0) {
        result.filteredItems.push(dir);
      }
      const dirResult = cleanUpInputArray(rest);
      result.filteredItems = result.filteredItems.concat(dirResult.filteredItems);
      result.unsupportedFiles = result.unsupportedFiles.concat(dirResult.unsupportedFiles);
    }
  }

  return result;
}

export async function processFileOrDirectoryInfo(
  infoItem: TPortalFileInfo | TPortalAudioInfo | TPortalDirectoryInfo,
  path: string,
  queueItem: PreprocessingQueueItem,
  modeState: Mode<any>,
): Promise<(StoreItemTask | StoreItemTaskDirectory)[]> {
  if (infoItem.type === 'folder') {
    // folder
    const dir = infoItem as TPortalDirectoryInfo;
    // TODO
    throw new Error('not implemented');
  } else {
    const f = infoItem as TPortalFileInfo;
    return processFileInfo(f, path, queueItem, modeState);
  }
}

export async function processFileInfo(
  file: TPortalFileInfo | TPortalAudioInfo,
  path: string,
  queueItem: PreprocessingQueueItem,
  modeState: Mode<any>,
): Promise<(StoreItemTask | StoreItemTaskDirectory)[]> {
  let clonedFile = file.clone();
  if (!clonedFile?.file) {
    throw new Error('file is undefined');
  }

  clonedFile.hash = await getHashString(clonedFile.file);
  const hashString = clonedFile.hash.length === 64 ? clonedFile.hash.slice(-20) : clonedFile.hash;
  const newName = `${hashString}${clonedFile.extension}`;
  let newFileInfo: TPortalFileInfo | TPortalAudioInfo | undefined;

  if (newName !== clonedFile.fullname) {
    // no valid name, replace
    const newfile = await TPortalFileInfo.renameFile(clonedFile.file, newName, {
      type: clonedFile.type,
      lastModified: clonedFile.file.lastModified,
    });
    newFileInfo = new TPortalFileInfo(newfile.name, clonedFile.type, newfile.size, newfile);
    newFileInfo.attributes = { ...queueItem.infoItem.attributes };
    newFileInfo.attributes.originalFileName = clonedFile.fullname;
    newFileInfo.hash = clonedFile.hash;
    clonedFile = newFileInfo;
  } else {
    newFileInfo = clonedFile! as TPortalFileInfo;
    newFileInfo.attributes = { ...queueItem.infoItem.attributes };
    newFileInfo.attributes.originalFileName = clonedFile.fullname;
    clonedFile = newFileInfo;
  }

  if (!clonedFile?.file) {
    throw new Error('file is undefined');
  }
  if (!clonedFile?.hash) {
    throw new Error('hash is undefined');
  }

  if (clonedFile?.file) {
    const arrayBuffer = await readFileAsArray(clonedFile.file);
    const format: AudioFormat | undefined = AudioManager.getFileFormat(clonedFile.extension, AppInfo.audioFormats);

    if (format) {
      // it's an audio file
      await format.init(clonedFile.fullname, clonedFile.type, arrayBuffer);
      const audioInfo = getAudioInfo<TPortalAudioInfo, TPortalFileInfoAttributes>(
        TPortalAudioInfo,
        format,
        clonedFile.fullname,
        clonedFile.type,
        arrayBuffer,
      );

      newFileInfo = new TPortalAudioInfo(
        newName,
        clonedFile.file.type,
        clonedFile.file.size,
        format.sampleRate,
        audioInfo.duration.samples,
        audioInfo.channels,
        audioInfo.bitrate,
      );
      newFileInfo.hash = clonedFile.hash;
      newFileInfo.file = clonedFile.file;
      newFileInfo.attributes = { ...clonedFile.attributes };
      clonedFile = newFileInfo;
    } else {
      throw new Error('invalid audio file.');
    }

    let task: StoreItemTask | undefined;
    if (clonedFile) {
      // new file
      task = {
        directoryID: 0,
        files: [clonedFile],
        id: 0, // TODO check,
        operations: [],
        status: TaskStatus.QUEUED,
        type: 'task',
      };

      // TODO operation enabled missing

      for (const operationFactory of modeState.defaultOperations) {
        let op = operationFactory.create(0, 0, [
          new StoreTaskOperationProcessingRound({
            status: TaskStatus.PENDING,
          }),
        ]); // TODO CHECK
        op = operationFactory.applyTaskOptions(
          {
            asr: {
              provider: modeState.options.selectedASRProvider,
              language: modeState.options.selectedASRLanguage,
              diarization: {
                enabled: modeState.options.isDiarizationEnabled,
                speakers: modeState.options.diarizationSpeakers,
              },
            },
            maus: {
              language: modeState.options.selectedMausLanguage,
            },
            translation: {
              language: modeState.options.selectedTranslationLanguage,
            },
            summarization: {
              provider: modeState.options.selectedSummarizationProvider,
              numberOfWords: modeState.options.selectedSummarizationNumberOfWords,
            },
          },
          op,
        );
        task.operations.push(op);
      }

      return [task];
    } else {
      throw new Error('fileinfo is undefined');
    }
  } else {
    throw new Error('file is null');
  }
}

export async function getHashString(fileBlob: File) {
  if (cryptoSupported()) {
    return calcSHA256FromFile(fileBlob);
  }
  return `${fileBlob.name}_${fileBlob.size}`;
}

/*
async function processDirectoryInfo(
  dir: TPortalDirectoryInfo,
  queueItem: PreprocessingQueueItem,
  preprocessingState: PreprocessingState,
  splitPrompt: string,
): Promise<TaskDirectory[]> {
  const dirTask = new TaskDirectory(dir.path, dir.size);
  const processedValues: any = [];

  for (const dirEntry of dir.entries) {
    if (dirEntry instanceof FileInfo) {
      const file = dirEntry as TPortalFileInfo;
      processedValues.push(await processFileInfo(file, dir.path, queueItem, preprocessingState, splitPrompt));
    } else {
      throw new Error('file in dir is not a file!');
    }
  }
  const result = [];
  let content = [];

  const values = flatten(processedValues) as StoreItem[];

  for (const value of values) {
    if (value instanceof Task) {
      // set state
      for (let i = 0; i < affectedMode.operations.length; i++) {
        const operation = affectedMode.operations[i];
        value.operations[i].enabled = operation.enabled;
        value.operations[i].addProcessingRound();
      }
      content.push(value);
    } else {
      // is dir
      if (value.entries.length === 1) {
        content.push(value.entries[0]);
      } else {
        if (content.length > 0) {
          dirTask.addEntries(content);
          result.push(dirTask);
          content = [];
        }

        result.push(value);
      }
    }
  }
  if (content.length > 0) {
    dirTask.addEntries(content);
    result.push(dirTask);
  }

  return result;
}
 */
