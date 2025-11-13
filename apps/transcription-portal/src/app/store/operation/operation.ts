import { IOperationProcessingRoundWithoutResults } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { StoreFile } from '../store-item';

export interface StoreTaskOperation<T extends object = any, O extends StoreTaskOperation = any> {
  id: number;
  taskID: number;
  name: string;
  enabled: boolean;
  serviceProviderName?: string;
  estimatedEnd?: number;
  rounds: StoreTaskOperationProcessingRound[];
  options: T;
  protocol?: string;
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
