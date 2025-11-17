import { Action, createActionGroup, emptyProps, props } from '@ngrx/store';
import { IDBTaskItem } from '../../indexedDB';
import { TPortalModes } from '../mode';
import { StoreTaskOperation } from '../operation';
import { StoreAudioFile, StoreFile, StoreFileDirectory, StoreItem, StoreItemTaskOptions, TaskStatus } from './store-item';

export class StoreItemActions {
  static importTasks = createActionGroup({
    source: 'tasks/import',
    events: {
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static prepareTasks = createActionGroup({
    source: 'tasks/prepare',
    events: {
      do: props<{
        annotationTasks: IDBTaskItem[];
        summarizationTasks: IDBTaskItem[];
      }>(),
      success: emptyProps(),
    },
  });

  static removeTaskOrFolder = createActionGroup({
    source: 'tasks/remove task or folder',
    events: {
      do: props<{
        item: StoreItem;
      }>()
    },
  });

  static selectItems = createActionGroup({
    source: 'modes/current mode/select items',
    events: {
      do: props<{
        ids: number[];
        deselectOthers?: boolean;
      }>(),
    },
  });

  static deselectItems = createActionGroup({
    source: 'modes/current mode/deselect items',
    events: {
      do: props<{
        ids: number[];
        deselectOthers?: boolean;
      }>(),
    },
  });

  static setSelectedItems = createActionGroup({
    source: 'modes/current mode/set selected items',
    events: {
      do: props<{
        ids: number[];
      }>(),
    },
  });

  static importItemsFromProcessingQueue = createActionGroup({
    source: 'tasks/import items from queue',
    events: {
      do: props<{
        id: number;
        mode: TPortalModes;
        results: (StoreFile | StoreAudioFile | StoreFileDirectory)[];
      }>(),
      success: props<{
        mode: TPortalModes;
        id: number;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static toggleTaskDirectoryOpened = createActionGroup({
    source: 'tasks/toggle opened directory',
    events: {
      do: props<{
        dirID: number;
      }>(),
    },
  });

  static setItemMouseOver = createActionGroup({
    source: 'tasks/set mouseover',
    events: {
      do: props<{
        id: number;
        mouseOver: boolean;
      }>(),
    },
  });

  static removeStoreItems = createActionGroup({
    source: 'tasks/remove store items',
    events: {
      do: props<{
        ids: number[];
      }>(),
    },
  });

  static changeProcessingOptionsForEachQueuedTask = createActionGroup({
    source: 'tasks/change options for each task',
    events: {
      do: props<{
        options: StoreItemTaskOptions;
      }>(),
    },
  });

  static toggleProcessing = createActionGroup({
    source: 'tasks/toggle processing',
    events: {
      do: emptyProps(),
    },
  });

  static startProcessing = createActionGroup({
    source: 'tasks/start processing',
    events: {
      do: emptyProps(),
    },
  });

  static processNextStoreItem = createActionGroup({
    source: 'tasks/start next processing',
    events: {
      do: props<{
        mode: TPortalModes;
      }>(),
      nothingToDo: props<{
        mode: TPortalModes;
      }>(),
    },
  });

  static processStoreItem = createActionGroup({
    source: 'tasks/process item',
    events: {
      do: props<{
        mode: TPortalModes;
        id: number;
      }>(),
      success: props<{
        mode: TPortalModes;
        id: number;
      }>(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static changeTaskStatus = createActionGroup({
    source: 'tasks/change status',
    events: {
      do: props<{
        mode: TPortalModes;
        taskID: number;
        status: TaskStatus;
      }>(),
      success: emptyProps(),
      fail: props<{
        error: string;
      }>(),
    },
  });

  static stopProcessing = createActionGroup({
    source: 'tasks/stop processing',
    events: {
      do: emptyProps(),
    },
  });

  static processNextOperation = createActionGroup({
    source: 'tasks/start next operation',
    events: {
      do: props<{
        taskID: number;
        mode: TPortalModes;
      }>(),
      success: props<{
        taskID: number;
        mode: TPortalModes;
        operation: StoreTaskOperation;
      }>(),
      fail: props<{
        error: string;
        taskID: number;
        mode: TPortalModes;
        operationID: number;
      }>(),
    },
  });

  static changeOperation = createActionGroup({
    source: 'tasks/change operation',
    events: {
      do: props<{
        mode: TPortalModes;
        taskID: number;
        operation: StoreTaskOperation;
      }>()
    },
  });

  static runOperationWithTool = createActionGroup({
      source: 'tasks/open operation with tool',
      events: {
        do: props<{
          taskID: number;
          operationID: number;
          operationName: string;
          language: string;
          audioFile: StoreAudioFile;
        }>(),
        prepare: props<{
          mode: TPortalModes;
          taskID: number;
          operationID: number;
          roundIndex: number;
          operationName: string;
          language: string;
        }>(),
        success: props<{
          mode: TPortalModes;
          taskID: number;
          operationID: number;
          operationName: string;
          language: string;
          audioFile: StoreAudioFile;
          transcript?: StoreFile;
          url?: string;
        }>(),
        fail: props<{
          error: string;
        }>(),
      }
  });

  static reuploadFilesForOperations = createActionGroup({
      source: 'tasks/reupload files for operations',
      events: {
        do: props<{
          mode: TPortalModes;
          list: {
            taskID: number;
            operationID: number;
            roundIndex: number;
            files: StoreFile[];
          }[];
          actionAfterSuccess: Action;
        }>(),
        success: props<{
          mode: TPortalModes;
          list: {
            taskID: number;
            operationID: number;
            roundIndex: number;
            files: StoreFile[];
          }[];
          actionAfterSuccess: Action;
        }>(),
        fail: props<{
          error: string;
        }>(),
      }
  });


  static updateTaskFiles = createActionGroup({
      source: 'tasks/update files',
      events: {
        do: props<{
          mode: TPortalModes;
          taskID: number;
          files: StoreFile[];
        }>()
      }
  });


}
