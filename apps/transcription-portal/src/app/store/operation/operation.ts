import { last } from '@octra/utilities';
import { IOperationProcessingRoundWithoutResults } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';

export class StoreTaskOperation<T extends object = any> {
  id!: number;
  taskID!: number;
  name!: string;
  enabled!: boolean;
  mouseOver?: boolean;
  serviceProviderName?: string;
  estimatedEnd?: number;
  rounds!: StoreTaskOperationProcessingRound[];
  options!: T;

  // TODO implement
  parsedProtocol: any[] = [];

  get lastRound(): StoreTaskOperationProcessingRound | undefined {
    return last(this.rounds);
  }

  get lastResult(): TPortalFileInfo | undefined {
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

  constructor(partial?: Partial<StoreTaskOperation<T>>) {
    Object.assign(this, partial);
  }
}

export class StoreTaskOperationProcessingRound implements IOperationProcessingRoundWithoutResults {
  results: TPortalFileInfo[] = [];
  status!: TaskStatus;
  time?: { start: number; duration?: number };
  protocol?: string;

  get lastResult(): TPortalFileInfo | undefined {
    return last(this.results);
  }

  constructor(partial?: Partial<StoreTaskOperationProcessingRound>) {
    Object.assign(this, partial);
  }
}
