import { TPortalAudioInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { StoreTaskOperation } from '../operation';

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

export interface StoreTask {
  id: number;
  mouseOver: boolean;
  stopRequested: boolean;
  files: (TPortalFileInfo | TPortalAudioInfo)[];
  operations: StoreTaskOperation[];
  directoryID?: number;
  status: TaskStatus;
}
