import { FileInfoSerialized } from '@octra/web-media';
import { OperationProcessingRoundSerialized } from '../obj/operations/operation';
import { TaskStatus } from '../obj/tasks';

export interface IDBUserSettingsItem<T> {
  name: string;
  value: T;
}

export interface IDBUserDefaultSettingsItemData {
  asrLanguage?: string;
  asrProvider?: string;
  mausLanguage?: string;
  summarizationProvider?: string;
  summarizationWordLimit?: number;
  diarization?: boolean;
  diarizationSpeakers?: number;
  translationLanguage?: string;
}
export type IDBUserDefaultSettingsItem = IDBUserSettingsItem<IDBUserDefaultSettingsItemData>;

export interface IDBNotificationSettingsItemData {
  enabled: boolean;
}
export type IDBNotificationSettingsItem = IDBUserSettingsItem<IDBNotificationSettingsItemData>;

export interface IDBTaskItem {
  id: number;
  type: 'task';
  state: TaskStatus;
  folderPath: string;
  files: (FileInfoSerialized | AudioFileInfoSerialized)[];
  operations: IDBOperation[];
}

export interface IDBFolderItem {
  id: number;
  type: 'folder';
  path: string;
  entries: IDBTaskItem[];
}

export interface AudioFileInfoSerialized extends FileInfoSerialized {
  sampleRate: number;
  bitsPerSecond: number;
  channels: number;
  duration: number;
}

export interface IDBInternItem {
  name: string;
  value: any;
}

export interface IDBOperation {
  id: number;
  name: string;
  enabled: boolean;
  rounds: OperationProcessingRoundSerialized[];
  serviceProvider?: string;
  diarization?: {
    enabled?: boolean;
    speakers?: number;
  };
  language?: string;
  maxNumbersOfWords?: number;
}
