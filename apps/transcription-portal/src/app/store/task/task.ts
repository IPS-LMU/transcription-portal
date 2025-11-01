import { TPortalAudioInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { TaskDirectory } from '../../obj/tasks';
import { Operation } from '../operation/operation';

export enum TaskStatus {
  INACTIVE = 'INACTIVE',
  QUEUED = 'QUEUED',
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  UPLOADING = 'UPLOADING',
  READY = 'READY',
  SKIPPED = 'SKIPPED',
  FINISHED = 'FINISHED',
  ERROR = 'ERROR',
}

export interface Task {
  id: number;
  mouseOver: boolean;
  stopRequested: boolean;
  files: (TPortalFileInfo | TPortalAudioInfo)[];
  operations: Operation[];
  directory?: TaskDirectory;
  status: TaskStatus;
}
