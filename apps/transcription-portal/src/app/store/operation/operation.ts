import { StoreFile, TaskStatus } from '../store-item';
import { FileInfoSerialized } from '@octra/web-media';

export interface StoreTaskOperation<T extends object = any, O extends StoreTaskOperation = any> {
  id: number;
  taskID: number;
  name: string;
  enabled: boolean;
  serviceProviderName?: string;
  rounds: StoreTaskOperationProcessingRound[];
  options: T;
  protocol?: string;
}

export interface IOperationProcessingRoundWithoutResults {
  status: TaskStatus;
  time?: {
    start: number;
    duration?: number;
  };
  protocol?: string;
}

export interface OperationProcessingRoundSerialized extends IOperationProcessingRoundWithoutResults {
  results: FileInfoSerialized[];
}

export interface StoreTaskOperationProcessingRound extends IOperationProcessingRoundWithoutResults {
  results: StoreFile[];
  status: TaskStatus;
  time?: { start: number; duration?: number };
  protocol?: string;
  // TODO implement
  parsedProtocol?: any[];
  progress?: number;
  estimatedEnd?: number | undefined;
}
