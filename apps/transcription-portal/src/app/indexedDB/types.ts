import { FileInfoSerialized } from '@octra/web-media';
import { IOperation } from '../obj/operations/operation';
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
  translationLanguage?: string;
}
export type IDBUserDefaultSettingsItem = IDBUserSettingsItem<IDBUserDefaultSettingsItemData>

export interface IDBNotificationSettingsItemData {
  enabled: boolean;
}
export type IDBNotificationSettingsItem = IDBUserSettingsItem<IDBNotificationSettingsItemData>

export interface IDBTaskItem {
  id: number;
  type: 'folder' | 'task';
  state: TaskStatus;
  folderPath: string;
  files: (FileInfoSerialized | AudioFileInfoSerialized)[];
  operations: IOperation[];
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
