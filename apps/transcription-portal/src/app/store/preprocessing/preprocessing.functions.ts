import { IFile } from '@octra/annotation';
import { AudioCutter, AudioFormat, AudioInfo, AudioManager, DirectoryInfo, FileInfo, getAudioInfo, readFileContents } from '@octra/web-media';
import { AppInfo } from '../../app.info';
import { calcSHA256FromFile, cryptoSupported } from '../../obj/CryptoHelper';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo, TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
import { readFileAsArray, validTranscript } from '../../obj/functions';
import { StoreAudioFile, StoreFile, StoreFileDirectory } from '../store-item';
import { PreprocessingQueueItem } from './preprocessing.state';

export async function splitAudioFile(
  audioFile: StoreAudioFile,
  splitType: 'FIRST' | 'BOTH' | 'SECOND',
  path = '',
): Promise<(StoreFile | StoreAudioFile | StoreFileDirectory)[]> {
  if (audioFile.blob) {
    const originalFileName = audioFile.attributes?.originalFileName ?? audioFile.name;
    const audioInfo = new AudioInfo(
      originalFileName,
      audioFile.type,
      audioFile.size,
      audioFile.sampleRate,
      audioFile.duration,
      audioFile.channels,
      audioFile.bitrate,
      audioFile.audioBufferInfo,
    );
    const cutter = new AudioCutter(audioInfo);
    const arrayBuffer = await readFileContents<ArrayBuffer>(audioFile.blob, 'arraybuffer');
    const files: File[] = await cutter.splitChannelsToFiles(originalFileName, [0, 1], arrayBuffer);

    if (splitType === 'FIRST') {
      files.splice(1, 1);
    } else if (splitType === 'SECOND') {
      files.splice(0, 1);
    } else {
      // use all files => do not remove anything.
    }

    const fileInfos: StoreAudioFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const fileObj = files[i];
      const { name, extension } = FileInfo.extractFileName(originalFileName);
      const num = splitType === 'BOTH' ? i + 1 : splitType === 'FIRST' ? 1 : 2;
      const newFileName = `${name.replace(/\..+$/g, '')}_${num}${extension}`;
      const fileInfo: StoreAudioFile = {
        attributes: {
          originalFileName: newFileName,
        },
        audioBufferInfo: audioInfo.audioBufferInfo,
        available: true,
        bitrate: audioInfo.bitrate,
        blob: fileObj,
        channels: 1,
        duration: audioInfo.duration.samples,
        hash: await calcSHA256FromFile(fileObj),
        name: newFileName,
        sampleRate: audioInfo.sampleRate,
        size: fileObj.size,
        type: fileObj.type,
      };
      fileInfos.push(fileInfo);
    }

    if (fileInfos.length > 1) {
      const directoryName = audioFile.attributes?.originalFileName.replace(/\..+$/g, '') + '_dir';
      const directory: StoreFileDirectory = {
        attributes: { originalFileName: directoryName },
        entries: fileInfos,
        name: directoryName,
        path: `${path}${directoryName}/`,
        size: 0,
        type: 'folder',
      };
      return [directory];
    } else {
      return fileInfos;
    }
  }
  throw new Error('Missing blob for audio file to split.');
}

/*
add task from queued preprocessing

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
  infoItem: StoreFile | StoreAudioFile | StoreFileDirectory,
  path: string,
  queueItem: PreprocessingQueueItem,
): Promise<(StoreFile | StoreAudioFile | StoreFileDirectory)[]> {
  if (infoItem.type === 'folder') {
    // folder
    const dir = infoItem as StoreFileDirectory;
    return processDirectoryInfo(dir, queueItem, path);
  } else {
    const f = infoItem as StoreFile;
    return processFileInfo(f, queueItem);
  }
}

/**
 * processes an FileInfo instance: hashing and retrieving audio information if needed.
 * @param file
 * @param path
 * @param queueItem
 * @param modeState
 */
export async function processFileInfo(file: StoreFile, queueItem: PreprocessingQueueItem): Promise<(StoreFile | StoreAudioFile)[]> {
  let clonedFile = { ...file } as StoreFile | StoreAudioFile;
  const blob = file.type.includes('audio') ? file.blob : new File([file.content!], file.name, { type: file.type });
  const extension = FileInfo.extractFileName(clonedFile.name).extension;

  if (!blob) {
    throw new Error('file is undefined');
  }

  clonedFile.hash = await getHashString(blob);
  const hashString = clonedFile.hash.length === 64 ? clonedFile.hash.slice(-20) : clonedFile.hash;
  const newName = `${hashString}${extension}`;

  if (newName !== clonedFile.name) {
    // no valid name, replace
    const newfile = await TPortalFileInfo.renameFile(blob, newName, {
      type: clonedFile.type,
      lastModified: blob.lastModified,
    });

    clonedFile = {
      name: newfile.name,
      type: clonedFile.type,
      size: newfile.size,
      blob: newfile,
      attributes: { ...queueItem.infoItem.attributes, originalFileName: clonedFile.name },
      hash: clonedFile.hash,
    };
  } else {
    clonedFile.attributes = { ...queueItem.infoItem.attributes };
    clonedFile.attributes.originalFileName = clonedFile.name;
  }

  if (!clonedFile.type.includes('audio')) {
    // it's a text file
    return [clonedFile];
  }

  if (!clonedFile?.hash) {
    throw new Error('hash is undefined');
  }

  const arrayBuffer = await readFileAsArray(blob);
  const format: AudioFormat | undefined = AudioManager.getFileFormat(extension, AppInfo.audioFormats);

  if (format) {
    // it's an audio file
    await format.init(clonedFile.name, clonedFile.type, arrayBuffer);
    const audioInfo = getAudioInfo<TPortalAudioInfo, TPortalFileInfoAttributes>(
      TPortalAudioInfo,
      format,
      clonedFile.name,
      clonedFile.type,
      arrayBuffer,
    );

    clonedFile = {
      ...clonedFile,
      sampleRate: audioInfo.sampleRate,
      bitrate: audioInfo.bitrate,
      duration: audioInfo.duration,
      channels: audioInfo.channels,
      audioBufferInfo: audioInfo.audioBufferInfo,
    };
  } else {
    throw new Error('invalid audio file.');
  }

  return [clonedFile];
}

export async function getHashString(fileBlob: File) {
  if (cryptoSupported()) {
    return calcSHA256FromFile(fileBlob);
  }
  return `${fileBlob.name}_${fileBlob.size}`;
}

async function processDirectoryInfo(
  dir: StoreFileDirectory,
  queueItem: PreprocessingQueueItem,
  path?: string,
): Promise<(StoreFile | StoreAudioFile | StoreFileDirectory)[]> {
  const processedValues: (StoreFile | StoreAudioFile)[][] = [];
  const dirEntries = dir.entries ?? [];

  for (const dirEntry of dirEntries) {
    if (dirEntry.type !== 'folder') {
      const file = dirEntry as StoreFile;
      processedValues.push(await processFileInfo(file, queueItem));
    } else {
      throw new Error('file in dir is not a file!');
    }
  }

  const newDir: StoreFileDirectory = {
    attributes: dir.attributes,
    entries: processedValues.flat(),
    hash: dir.hash,
    name: dir.name,
    path: path + '/' + dir.name,
    size: dir.size,
    type: 'folder',
  };

  return [newDir];
}
