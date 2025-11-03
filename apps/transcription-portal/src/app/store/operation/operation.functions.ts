import { last } from '@octra/utilities';
import { FileInfoSerialized } from '@octra/web-media';
import { IDBTaskItem } from '../../indexedDB';
import { IOperation, OperationProcessingRoundSerialized } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { StoreTask } from '../task';
import { StoreTaskDirectory } from '../task-directory';
import { StoreTaskOperation, StoreTaskOperationProcessingRound } from './operation';

export function convertIDBOperationToStoreOperation(operation: IOperation, taskID: number): StoreTaskOperation {
  return {
    enabled: operation.enabled,
    estimatedEnd: undefined,
    id: operation.id,
    mouseOver: false,
    name: operation.name,
    rounds: operation.rounds.map((a) => convertIDBOperationRoundToStoreRound(a)),
    serviceProviderBASName: operation.serviceProvider,
    taskID,
    options: operation.options,
  };
}

export function convertIDBOperationRoundToStoreRound(round: OperationProcessingRoundSerialized): StoreTaskOperationProcessingRound {
  return new StoreTaskOperationProcessingRound({
    protocol: round.protocol,
    results: round.results.map((a) => TPortalFileInfo.fromAny(a)) as TPortalFileInfo[],
    status: round.status
  });
}

export async function convertStoreTaskToIDBTask(task: StoreTask, taskDirectory: StoreTaskDirectory): Promise<IDBTaskItem> {
  return new Promise<IDBTaskItem>((resolve, reject) => {
    const result: IDBTaskItem = {
      id: task.id,
      type: 'task',
      state: task.status,
      folderPath: '',
      files: [],
      operations: [],
    };

    // read file data
    const filePromises: Promise<FileInfoSerialized>[] = [];
    for (const file of task.files) {
      filePromises.push(file.toAny());
    }

    Promise.all(filePromises)
      .then((serializedFiles) => {
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
      })
      .catch((error) => {
        reject(error);
      });
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
    serviceProvider: operation.serviceProviderBASName,
    options: operation.options,
  };
}

export async function convertStoreOperationRoundToIDBOperationRound(
  round: StoreTaskOperationProcessingRound,
): Promise<OperationProcessingRoundSerialized> {
  const results = await Promise.all<Promise<FileInfoSerialized>[]>(round.results.map((a) => a.toAny()));
  return { protocol: round.protocol, results, status: round.status };
}

export function getLatestRoundFromStoreOperation(operation: StoreTaskOperation) {
  return operation.rounds ? last(operation.rounds) : undefined;
}

export function getOperationStatus(operation: StoreTaskOperation) {
  return getLatestRoundFromStoreOperation(operation)?.status ?? TaskStatus.PENDING;
}
