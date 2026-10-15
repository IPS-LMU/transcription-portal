import { FileInfoSerialized } from '@octra/web-media';
import { StoreFile, TaskStatus } from '../store-item';
import { OperationName } from './factory/factory.types';

export interface StoreTaskOperation<T extends object = any, O extends StoreTaskOperation = any> {
  id: number;
  taskID: number;
  name: OperationName;
  enabled: boolean;
  serviceProviderName?: string;
  rounds: StoreTaskOperationProcessingRound[];
  options: T;
  protocol?: string;
}

export interface IOperationProcessingRoundWithoutResults {
  id: number;
  status: TaskStatus;
  time?: {
    start: number;
    duration?: number;
  };
  protocol?: string;
}

export interface IOperationProcessingRoundWithResults<R> extends IOperationProcessingRoundWithoutResults {
  results: R[];
  progress?: number;
  parsedProtocol?: StoreTaskOperationProtocolItem[];
}

export class StoreTaskOperationProcessingRound<R extends any = StoreFile,
  P extends IOperationProcessingRoundWithResults<R> = IOperationProcessingRoundWithResults<R>,
> implements IOperationProcessingRoundWithResults<R> {
  private static idCounter = 1;

  id!: number;
  results!: R[];
  status!: TaskStatus;
  time?: { start: number; duration?: number };
  protocol?: string;
  parsedProtocol?: StoreTaskOperationProtocolItem[];
  progress?: number;
  estimatedEnd?: number | undefined;

  constructor(partial?: Partial<StoreTaskOperationProcessingRound<R, P>>) {
    Object.assign(this, partial);

    if (partial?.id) {
      // make sure that id is everytime max value
      StoreTaskOperationProcessingRound.idCounter = Math.max(StoreTaskOperationProcessingRound.idCounter, partial.id);
    } else {
      this.id = StoreTaskOperationProcessingRound.idCounter++;
    }
  }
}

export class OperationProcessingRoundSerialized extends StoreTaskOperationProcessingRound<FileInfoSerialized, OperationProcessingRoundSerialized> {
}

export interface StoreTaskOperationProtocolItem {
  type: 'ERROR' | 'WARNING';
  message: string;
}
