import { last } from '@octra/utilities';
import { AudioFileInfoSerialized, FileInfoSerialized } from '@octra/web-media';
import { IDBOperation, IDBTaskItem } from '../../indexedDB';
import { IOperation, OperationProcessingRoundSerialized } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { StoreAudioFile, StoreFile, StoreItemTask, StoreItemTaskDirectory } from '../store-item';
import { convertIDBFileToStoreFile } from '../store-item/store-item.functions';
import { OperationFactory } from './factory';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from './operation';

export function convertIDBOperationToStoreOperation(
  operation: IDBOperation,
  task: IDBTaskItem,
  defaultOperations: {
    factory: OperationFactory;
    enabled: boolean;
  }[],
): StoreTaskOperation {
  console.log(`look for ${operation.name} in ${defaultOperations.map((a) => a.factory.name).join(', ')}`);
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

export async function convertStoreTaskToIDBTask(task: StoreItemTask, taskDirectory?: StoreItemTaskDirectory): Promise<IDBTaskItem> {
  return new Promise<IDBTaskItem>((resolve, reject) => {
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
      operationPromises.push(convertStoreOperationToIDBOperation(operation));
    }

    if (operationPromises.length > 0) {
      Promise.all(operationPromises)
        .then((serializedOperations) => {
          result.operations = serializedOperations;
          resolve(result);
        })
        .catch((error) => {
          console.error('not arrived');
          reject(error);
        });
    } else {
      resolve(result);
    }
  });
}

export async function convertStoreOperationToIDBOperation(operation: StoreTaskOperation): Promise<IOperation> {
  return {
    enabled: operation.enabled,
    id: operation.id,
    name: operation.name,
    rounds: await Promise.all<Promise<OperationProcessingRoundSerialized>[]>(
      operation.rounds.map((a) => convertStoreOperationRoundToIDBOperationRound(a)),
    ),
    serviceProvider: operation.serviceProviderName,
    options: operation.options,
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
  operation.rounds.push(
    round ?? {
      status: TaskStatus.PENDING,
      results: [],
    },
  );
  return operation;
}

export function getLastOperationResultFromLatestRound(operation: StoreTaskOperation) {
  return last(getLastOperationRound(operation)?.results ?? []);
}
