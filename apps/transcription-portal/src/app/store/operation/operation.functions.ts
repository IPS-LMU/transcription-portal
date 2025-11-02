import { IOperation, Operation, OperationProcessingRoundSerialized } from '../../obj/operations/operation';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { StoreTask } from '../task';
import { OperationProcessingRound, StoreTaskOperation } from './operation';

export function convertIDBOperationToStoreOperation(operation: IOperation, taskID: number, defaultOperation: Operation): StoreTaskOperation {
  return {
    description: defaultOperation.description,
    enabled: operation.enabled,
    estimatedEnd: undefined,
    id: operation.id,
    mouseOver: false,
    name: operation.name,
    resultType: defaultOperation.resultType,
    rounds: operation.rounds.map((a) => convertIDBOperationRoundToStoreRound(a)),
    serviceProviderBASName: operation.serviceProvider,
    shortTitle: defaultOperation.shortTitle,
    taskID,
    title: defaultOperation.title,
  };
}

export function convertIDBOperationRoundToStoreRound(round: OperationProcessingRoundSerialized): OperationProcessingRound {
  return new OperationProcessingRound({
    protocol: round.protocol,
    results: round.results.map((a) => TPortalFileInfo.fromAny(a)) as TPortalFileInfo[],
    status: round.status,
  });
}
