import { TPortalFileInfoAttributes } from '../../obj/TPortalFileInfoAttributes';
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

export interface StoreItemTaskOptions {
  asr?: {
    language?: string;
    provider?: string;
    diarization?: {
      enabled?: boolean;
      speakers?: number;
    };
  };
  maus?: {
    language?: string;
  };
  summarization?: {
    provider?: string;
    numberOfWords?: number;
  };
  translation?: {
    language?: string;
  };
}

export interface StoreItem {
  id: number;
  type: 'task' | 'folder';
  selected?: boolean;
  mouseOver?: boolean;

  // task
  stopRequested?: boolean;
  files?: (StoreFile | StoreAudioFile)[];
  operations?: StoreTaskOperation[];
  directoryID?: number;
  status?: TaskStatus;

  // folder
  path?: string;
  size?: number;
  folderName?: string;
  entries?: StoreItemsState;
  opened?: boolean;
}

export interface StoreItemTaskDirectory extends Omit<StoreItem, 'stopRequested' | 'files' | 'operations' | 'directoryID' | 'status'> {
  path: string;
  size?: number;
  folderName: string;
  entries: StoreItemsState;
  opened?: boolean;
}

export interface StoreItemTask extends Omit<StoreItem, 'path' | 'size' | 'folderName' | 'entries'> {
  stopRequested?: boolean;
  files: (StoreFile | StoreAudioFile)[];
  operations: StoreTaskOperation<any, StoreTaskOperation>[];
  directoryID?: number;
  status: TaskStatus;
}

export interface StoreFile {
  name: string;
  type: string;
  size: number;
  attributes: TPortalFileInfoAttributes;
  hash: string;
  url?: string;
  online?: boolean;
  content?: string;
  blob?: File;
}

export interface StoreFileDirectory {
  type: 'folder';
  name: string;
  size: number;
  path: string;
  attributes: TPortalFileInfoAttributes;
  hash?: string;
  entries?: (StoreFile | StoreFileDirectory)[];
}

export interface StoreAudioFile extends StoreFile {
  sampleRate: number;
  bitrate: number;
  channels: number;
  duration: number;
  audioBufferInfo?: { samples: number; sampleRate: number };
}
