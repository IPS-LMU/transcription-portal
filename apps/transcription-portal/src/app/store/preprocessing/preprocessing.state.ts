import { EntityState } from '@ngrx/entity';
import { StoreAudioFile, StoreFile, StoreFileDirectory } from '../store-item';

export enum ProcessingQueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  FINISHED = 'FINISHED',
  REMOVED = 'REMOVED',
  WAIT_FOR_SPLIT = 'WAIT_FOR_SPLIT',
  ERROR = 'ERROR',
}

export interface PreprocessingQueueItem {
  results: (StoreFile | StoreAudioFile | StoreFileDirectory)[];
  id: number;
  infoItem: StoreFile | StoreAudioFile | StoreFileDirectory;
  status: ProcessingQueueStatus;
}

export interface PreprocessingState extends EntityState<PreprocessingQueueItem> {}
