import { last } from '@octra/utilities';
import { IOperationProcessingRoundWithoutResults } from '../../obj/operations/operation';
import { TaskStatus } from '../../obj/tasks';
import { TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';

export interface Operation {
  id: number;
  taskID: number;
  name: string;
  title: string;
  description: string;
  enabled: boolean;
  commands: string[];
  parsedProtocol?: string;
  resultType?: string;
  mouseOver?: boolean;
  shortTitle: string;
  serviceProviderBASName?: string;
  estimatedEnd?: number;
  rounds: OperationProcessingRound[];
}

export class OperationProcessingRound implements IOperationProcessingRoundWithoutResults {
  results: TPortalFileInfo[] = [];
  status!: TaskStatus;
  time?: { start: number; duration?: number };
  protocol?: string;

  get lastResult(): TPortalFileInfo | undefined {
    return last(this.results);
  }

  constructor(partial?: Partial<OperationProcessingRound>) {
    Object.assign(this, partial);
  }
}
