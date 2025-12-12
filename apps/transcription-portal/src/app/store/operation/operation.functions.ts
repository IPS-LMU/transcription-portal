import { last } from '@octra/utilities';
import { AudioFileInfoSerialized, FileInfoSerialized } from '@octra/web-media';
import { IDBFolderItem, IDBOperation, IDBTaskItem, IOperation } from '../../indexedDB';
import { StoreAudioFile, StoreFile, StoreItem, StoreItemTask, StoreItemTaskDirectory, TaskStatus } from '../store-item';
import { convertIDBFileToStoreFile } from '../store-item/store-item.functions';
import { OperationFactory } from './factory';
import { OperationProcessingRoundSerialized, StoreTaskOperation, StoreTaskOperationProcessingRound } from './operation';

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
  result = factory.applyTaskOptions(
    {
      asr: {
        language: operation.name === 'ASR' ? operation.language : undefined,
        diarization: operation.diarization,
        provider: operation.serviceProvider,
      },
    },
    result,
  );

  return result;
}

export function convertIDBOperationRoundToStoreRound(round: OperationProcessingRoundSerialized): StoreTaskOperationProcessingRound {
  return {
    protocol: round.protocol,
    results: round.results.map((a) => convertIDBFileToStoreFile(a)),
    status: round.status,
  };
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
  return { protocol: round.protocol, results, status: round.status };
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

export function getLastOperationRound(operation: StoreTaskOperation) {
  return last(operation.rounds);
}

export function addProcessingRound(operation: StoreTaskOperation, round?: StoreTaskOperationProcessingRound) {
  return {
    ...operation,
    rounds: [
      ...operation.rounds,
      {
        ...(round ?? {
          status: TaskStatus.PENDING,
          results: [],
        }),
      },
    ],
  };
}

export function getLastOperationResultFromLatestRound(operation: StoreTaskOperation) {
  return last(getLastOperationRound(operation)?.results ?? []);
}
