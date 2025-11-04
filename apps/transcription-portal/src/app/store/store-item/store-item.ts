import { TPortalAudioInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { StoreTaskOperation } from '../operation';
import { StoreItemsState } from './store-items-state';

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

export interface StoreItem {
  id: number;
  type: 'task' | 'folder';
  selected?: boolean;

  // task
  stopRequested?: boolean;
  files?: (TPortalFileInfo | TPortalAudioInfo)[];
  operations?: StoreTaskOperation[];
  directoryID?: number;
  status?: TaskStatus;

  // folder
  path?: string;
  size?: number;
  folderName?: string;
  entries?: StoreItemsState;
}

export interface StoreItemTaskDirectory extends Omit<StoreItem, 'stopRequested' | 'files' | 'operations' | 'directoryID' | 'status'> {
  path: string;
  size?: number;
  folderName: string;
  entries: StoreItemsState;
}

export interface StoreItemTask extends Omit<StoreItem, 'path' | 'size' | 'folderName' | 'entries'> {
  stopRequested: boolean;
  files: (TPortalFileInfo | TPortalAudioInfo)[];
  operations: StoreTaskOperation[];
  directoryID?: number;
  status: TaskStatus;
}
