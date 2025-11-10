import { last } from '@octra/utilities';
import { IOperationProcessingRoundWithoutResults } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { StoreFile } from '../store-item';

export class StoreTaskOperation<T extends object = any, O extends StoreTaskOperation = any> {
  id!: number;
  taskID!: number;
  name!: string;
  enabled!: boolean;
  serviceProviderName?: string;
  estimatedEnd?: number;
  rounds!: StoreTaskOperationProcessingRound[];
  options!: T;

  // TODO implement
  parsedProtocol: any[] = [];

  get lastRound(): StoreTaskOperationProcessingRound | undefined {
    return last(this.rounds);
  }

  get lastResult(): StoreFile | undefined {
    return this.lastRound?.lastResult;
  }

  get status(): TaskStatus {
    return this.lastRound?.status ?? TaskStatus.PENDING;
  }

  get protocol(): string | undefined {
    return this.lastRound?.protocol;
  }

  get time(): { start: number; duration?: number } | undefined {
    return this.lastRound?.time;
  }

  constructor(partial?: Partial<StoreTaskOperation<T, O>>) {
    Object.assign(this, partial);
  }

  clone(): O {
    throw new Error('Not implemented');
  }

  duplicate(partial?: Partial<StoreTaskOperation<T, O>>): O {
    throw new Error('Not implemented');
  }
}

export class StoreTaskOperationProcessingRound implements IOperationProcessingRoundWithoutResults {
  results: StoreFile[] = [];
  status!: TaskStatus;
  time?: { start: number; duration?: number };
  protocol?: string;

  get lastResult(): StoreFile | undefined {
    return last(this.results);
  }

  constructor(partial?: Partial<StoreTaskOperationProcessingRound>) {
    Object.assign(this, partial);
  }
}
