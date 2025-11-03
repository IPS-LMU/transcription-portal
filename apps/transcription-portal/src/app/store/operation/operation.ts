import { last } from '@octra/utilities';
import { IOperationProcessingRoundWithoutResults } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';

export interface StoreTaskOperation<T extends object = any> {
  id: number;
  taskID: number;
  name: string;
  enabled: boolean;
  mouseOver?: boolean;
  serviceProviderBASName?: string;
  estimatedEnd?: number;
  rounds: StoreTaskOperationProcessingRound[];

  options: T;
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
