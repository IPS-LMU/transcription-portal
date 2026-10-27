import { last } from '@octra/utilities';
import { AudioFileInfoSerialized, FileInfoSerialized } from '@octra/web-media';
import { IDBFolderItem, IDBOperation, IDBTaskItem, IOperation } from '../../indexedDB';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { StoreAudioFile, StoreFile, StoreItem, StoreItemTask, StoreItemTaskDirectory, TaskStatus } from '../store-item';
import { convertIDBFileToStoreFile } from '../store-item/store-item.functions';
import { OperationFactory } from './factory';
import {
  OperationProcessingRoundSerialized,
  StoreTaskOperation,
  StoreTaskOperationProcessingRound,
  StoreTaskOperationProtocolItem,
} from './operation';

export function convertIDBOperationToStoreOperation(
  operation: IDBOperation,
  task: IDBTaskItem,
  defaultOperations: {
    factory: OperationFactory;
    enabled: boolean;
  }[],
): StoreTaskOperation {
  const { factory, enabled } = defaultOperations.find((a) => a.factory.name === operation.name)!;
  let result = factory.create(
    operation.id,
    task.id,
    operation.rounds.map((a) => convertIDBOperationRoundToStoreRound(a)),
  );
  result.serviceProviderName = operation.serviceProvider;
  result.enabled = operation.enabled === undefined && task.state === TaskStatus.QUEUED ? enabled : operation.enabled;

  const asrOperation = task.operations.find((a) => a.name === 'ASR');
  const mausOperation = task.operations.find((a) => a.name === 'MAUS');
  const summarizationOperation = task.operations.find((a) => a.name === 'Summarization');
  const translationOperation = task.operations.find((a) => a.name === 'Translation');

  result = factory.applyTaskOptions(
    {
      asr: {
        language: asrOperation ? asrOperation.language : undefined,
        diarization: asrOperation?.diarization,
        provider: asrOperation ? asrOperation.serviceProvider : undefined,
      },
      maus: {
        language: mausOperation ? mausOperation.language : undefined,
      },
      summarization: {
        provider: summarizationOperation ? summarizationOperation.serviceProvider : undefined,
        numberOfWords: summarizationOperation ? summarizationOperation.maxNumbersOfWords : undefined,
      },
      translation: {
        language: translationOperation ? translationOperation.language : undefined,
      },
    },
    result,
  );

  return result;
}

export function convertIDBOperationRoundToStoreRound(round: OperationProcessingRoundSerialized): StoreTaskOperationProcessingRound {
  return new StoreTaskOperationProcessingRound({
    id: round.id,
    protocol: round.protocol,
    parsedProtocol: parseProtocol(round.protocol),
    results: round.results.map((a) => convertIDBFileToStoreFile(a)),
    status: round.status,
    time: round.time,
  });
}

export async function convertStoreItemToIDBItem(
  item: StoreItem,
  defaultOperations: {
    factory: OperationFactory<any>;
    enabled: boolean;
  }[],
  taskDirectory?: StoreItemTaskDirectory,
): Promise<IDBTaskItem | IDBFolderItem> {
  if (item.type == 'task') {
    const task = item as StoreItemTask;
    const result: IDBTaskItem = {
      id: task.id,
      type: 'task',
      state: task.status,
      disabled: task.disabled,
      folderPath: '',
      files: [],
      operations: [],
    };

    const serializedFiles = task.files.map(convertStoreFileToIDBFile);
    result.files.push(...serializedFiles);
    result.folderPath = !taskDirectory ? '' : taskDirectory.path;

    // read operation data
    const operationPromises: Promise<IOperation>[] = [];
    for (const operation of task.operations) {
      const { factory } = defaultOperations.find((a) => a.factory.name === operation.name)!;
      operationPromises.push(factory.convertOperationToIDBOperation(operation));
    }

    if (operationPromises.length > 0) {
      const serializedOperations = await Promise.all(operationPromises);
      result.operations = serializedOperations;
    }

    return result;
  } else {
    // dir
    const dir = item as StoreItemTaskDirectory;
    const serializedDir: IDBFolderItem = {
      entries: [],
      id: dir.id,
      path: dir.path,
      disabled: dir.disabled,
      type: 'folder',
    };

    for (const entryID of dir.entries.ids) {
      const entry = dir.entries.entities[entryID]!;
      serializedDir.entries.push((await convertStoreItemToIDBItem(entry, defaultOperations, dir)) as IDBTaskItem);
    }

    return serializedDir;
  }
}

export async function convertStoreOperationToIDBOperation(operation: StoreTaskOperation): Promise<IDBOperation> {
  return {
    enabled: operation.enabled,
    id: operation.id,
    name: operation.name,
    rounds: await Promise.all<Promise<OperationProcessingRoundSerialized>[]>(
      operation.rounds.map((a) => convertStoreOperationRoundToIDBOperationRound(a)),
    ),
    serviceProvider: operation.serviceProviderName,
  };
}

export async function convertStoreOperationRoundToIDBOperationRound(
  round: StoreTaskOperationProcessingRound,
): Promise<OperationProcessingRoundSerialized> {
  const results: (FileInfoSerialized | AudioFileInfoSerialized)[] = round.results.map((a) => convertStoreFileToIDBFile(a));
  return { id: round.id, protocol: round.protocol, results, status: round.status, time: round.time };
}

export function convertStoreFileToIDBFile(file: StoreFile | StoreAudioFile) {
  if (file.type.includes('audio')) {
    const audio = file as StoreAudioFile;

    return {
      fullname: audio.name,
      attributes: audio.attributes,
      hash: audio.hash,
      type: audio.type,
      size: audio.size,
      audioBufferInfo: audio.audioBufferInfo,
      duration: audio.duration,
      channels: audio.channels,
      sampleRate: audio.sampleRate,
      bitsPerSecond: audio.bitrate,
      url: audio.url,
      online: audio.online,
    };
  } else {
    return {
      fullname: file.name,
      attributes: file.attributes,
      hash: file.hash,
      type: file.type,
      size: file.size,
      url: file.url,
      online: file.online,
      content: file.content,
    };
  }
}

export function convertStoreFileToFileInfo(file: StoreFile): TPortalFileInfo {
  const info = new TPortalFileInfo(file.name, file.type, file.size);
  info.attributes = { ...file.attributes };
  info.url = file.url;
  info.online = file.online ?? false;
  info.hash = file.hash;
  info.file = file.blob ?? (file.content ? new File([file.content], file.attributes?.originalFileName ?? file.name, { type: file.type }) : undefined);
  return info;
}

export function getLastOperationRound(operation: StoreTaskOperation) {
  return last(operation.rounds);
}

export function addProcessingRound(operation: StoreTaskOperation, round?: StoreTaskOperationProcessingRound) {
  return {
    ...operation,
    rounds: [
      ...operation.rounds,
      new StoreTaskOperationProcessingRound({
        ...(round ?? {
          status: TaskStatus.PENDING,
          results: [],
        }),
      }),
    ],
  };
}

export function getLastOperationResultFromLatestRound(operation: StoreTaskOperation) {
  return last(getLastOperationRound(operation)?.results ?? []);
}

export function parseProtocol(protocol?: string): StoreTaskOperationProtocolItem[] {
  if (!protocol) {
    return [];
  } else {
    const result: StoreTaskOperationProtocolItem[] = [];
    const text = protocol.replace(/<br\/>/g, '\n');
    const regex = /((?:ERROR)|(?:WARNING)): (.+)$/gm;
    let match = regex.exec(text);

    while (match !== null) {
      result.push({
        type: match[1] as 'WARNING' | 'ERROR',
        message: match.length < 3 || !match[2] ? '' : match[2].replace(/(ACCESSCODE=)([^&\n]+)/g, '$1****'),
      });
      match = regex.exec(text);
    }

    return result;
  }
}
