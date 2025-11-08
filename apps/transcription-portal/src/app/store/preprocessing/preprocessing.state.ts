import { EntityState } from '@ngrx/entity';
import { TPortalAudioInfo, TPortalDirectoryInfo, TPortalFileInfo } from '../../obj/TPortalFileInfoAttributes';
import { StoreItem } from '../store-item';

export enum ProcessingQueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED',
  REMOVED = 'REMOVED',
  WAIT_FOR_SPLIT = 'WAIT_FOR_SPLIT',
  ERROR = 'ERROR',
}

export interface PreprocessingQueueItem {
  results: StoreItem[];
  id: number;
  infoItem: TPortalFileInfo | TPortalAudioInfo | TPortalDirectoryInfo;
  status: ProcessingQueueStatus;
}

export interface PreprocessingState extends EntityState<PreprocessingQueueItem> {}
