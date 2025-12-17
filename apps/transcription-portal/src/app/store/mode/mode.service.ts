import { inject, Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { RootState } from '../app';
import { ASROperation, StoreTaskOperation } from '../operation';
import { OctraWindowMessageEventData, StoreAudioFile, StoreItem, StoreItemTask, StoreItemTaskOptions } from '../store-item';
import { StoreItemActions } from '../store-item/store-item.actions';
import { ModeActions } from './mode.actions';
import {
  selectAllCurrentTasks,
  selectAllTasks,
  selectCurrentMode,
  selectCurrentModeEntries,
  selectCurrentModeProtocol,
  selectCurrentModeSelectedEntries,
  selectCurrentModeStatistics,
  selectDefaultOperations,
  selectDefaultOptions,
  selectOpenedToolOperation,
  selectOverallState,
  selectOverallStateLabel,
  selectOverallStatistics,
} from './mode.selectors';
import { DefaultUserSettings, TPortalModes } from './mode.state';

@Injectable({ providedIn: 'root' })
export class ModeStoreService {
  store: Store<RootState> = inject(Store);
  defaultModeOperations$ = this.store.select(selectDefaultOperations);
  currentModeEntries$ = this.store.select(selectCurrentModeEntries);
  currentModeSelectedEntries$ = this.store.select(selectCurrentModeSelectedEntries);
  allTasks$: Observable<StoreItemTask[] | undefined> = this.store.select(selectAllTasks);
  defaultUserSettings$ = this.store.select(selectDefaultOptions);
  currentModeStatistics$ = this.store.select(selectCurrentModeStatistics);
  overallStatistics$ = this.store.select(selectOverallStatistics);
  allCurrentTasks$ = this.store.select(selectAllCurrentTasks);
  currentMode$ = this.store.select(selectCurrentMode);
  overallState$ = this.store.select(selectOverallState);
  openedToolOperation$ = this.store.select(selectOpenedToolOperation);
  currentOverallStateLabel$ = this.store.select(selectOverallStateLabel);
  currentModeProtocol$ = this.store.select(selectCurrentModeProtocol);

  toggleSelectionForAllRows() {
    this.store.dispatch(StoreItemActions.toggleAllSelected.do());
  }

  selectAllRows() {
    this.store.dispatch(StoreItemActions.selectAllItems.do());
  }

  deselectAllRows() {
    this.store.dispatch(StoreItemActions.deselectAllItems.do());
  }

  selectRows(ids: number[], deselectOthers = false) {
    this.store.dispatch(StoreItemActions.selectItems.do({ ids, deselectOthers }));
  }

  deselectRows(ids: number[]) {
    this.store.dispatch(StoreItemActions.deselectItems.do({ ids }));
  }

  setSelectedRows(ids: number[]) {
    this.store.dispatch(StoreItemActions.setSelectedItems.do({ ids }));
  }

  setSelectedRowsByIndex(indices: number[]) {
    this.store.dispatch(StoreItemActions.setSelectedItemsByIndex.do({ indices }));
  }

  removeAppendingForSelectedItems() {
    this.store.dispatch(StoreItemActions.removeAppendingForSelectedItems.do());
  }

  removeTaskOrFolder(item: StoreItem) {
    this.store.dispatch(StoreItemActions.removeTaskOrFolder.do({ item }));
  }

  toggleDirectoryOpened(dirID: number) {
    this.store.dispatch(StoreItemActions.toggleTaskDirectoryOpened.do({ dirID }));
  }

  removeStoreItems(ids: number[]) {
    this.store.dispatch(StoreItemActions.removeStoreItems.do({ ids }));
  }

  updateProtocol() {
    this.store.dispatch(ModeActions.updateProtocolURL.do());
  }

  setDefaultOperationEnabled(name: string, enabled: boolean) {
    this.store.dispatch(
      ModeActions.setDefaultOperationEnabled.do({
        name,
        enabled,
      }),
    );
  }

  changeMode(mode: TPortalModes) {
    this.store.dispatch(
      ModeActions.changeMode.do({
        mode,
      }),
    );
  }

  validateQueuedTasks() {
    this.store.dispatch(StoreItemActions.validateQueuedTasks.do());
  }

  applyTaskOptionsOnQueuedTasks(options: StoreItemTaskOptions) {
    this.store.dispatch(
      StoreItemActions.changeProcessingOptionsForEachQueuedTask.do({
        options,
      }),
    );
  }

  setDefaultUserSettings(defaultUserSettings: DefaultUserSettings) {
    this.store.dispatch(ModeActions.setDefaultSettings.do({ defaultUserSettings }));
  }

  markValidQueuedTasksAsPending() {
    this.store.dispatch(StoreItemActions.markValidQueuedTasksAsPending.do());
  }

  startProcessing() {
    this.store.dispatch(StoreItemActions.startProcessing.do());
  }

  toggleProcessing() {
    this.store.dispatch(StoreItemActions.toggleProcessing.do());
  }

  changeOperation(mode: TPortalModes, taskID: number, operation: StoreTaskOperation) {
    this.store.dispatch(
      StoreItemActions.changeOperation.do({
        mode,
        taskID,
        operation,
      }),
    );
  }

  openOperationWithTool(operation: StoreTaskOperation, task: StoreItemTask) {
    this.store.dispatch(
      StoreItemActions.runOperationWithTool.do({
        taskID: operation.taskID,
        operationID: operation.id,
        operationName: operation.name,
        audioFile: task.files.find((a) => a.type.includes('audio')) as StoreAudioFile,
        language: (task.operations[0] as ASROperation).options.language!,
      }),
    );
  }

  receiveToolData(data: OctraWindowMessageEventData) {
    this.store.dispatch(StoreItemActions.receiveToolData.do(data));
  }

  closeToolLoader() {
    this.store.dispatch(ModeActions.closeToolLoader.do());
  }
}
