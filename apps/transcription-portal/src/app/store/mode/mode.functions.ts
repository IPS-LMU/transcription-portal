import { HttpClient } from '@angular/common/http';
import { last, SubscriptionManager } from '@octra/utilities';
import { Subscription } from 'rxjs';
import { OperationFactory, OperationSubscriptionManager } from '../operation';
import { StoreItem, StoreItemsState, StoreItemTask, StoreItemTaskDirectory, TaskStatus } from '../store-item';
import { TPortalModes } from './mode.state';

export function getIndexByEntry(selectedEntry: StoreItem, entities: StoreItem[]): number {
  let result = -1;

  for (const entry of entities) {
    if (entry.type === 'task') {
      const task = selectedEntry as StoreItemTask;
      if (entry.id === task.id) {
        return result + 1;
      }
    } else {
      // TaskDirectory
      const dir = selectedEntry as StoreItemTaskDirectory;
      if (entry.id !== selectedEntry.id) {
        for (let j = 0; j < dir.entries.ids.length; j++) {
          const id = dir.entries.ids[j];
          const subEntry = dir.entries.entities[id]!;

          if (subEntry.id === selectedEntry.id) {
            return result + j + 2;
          }
        }
        result += dir.entries.ids.length;
      } else {
        return result + 1;
      }
    }
    result++;
  }

  return result;
}

export function getAllTasks(itemsState: StoreItemsState): StoreItemTask[] {
  const results: StoreItemTask[] = [];
  const items = itemsState.ids.map((id) => itemsState.entities[id]!);

  for (const item of items) {
    if (item.type === 'task') {
      const t = item as StoreItemTask;
      results.push(t);
    } else {
      const d = item as StoreItemTaskDirectory;
      results.push(...getAllTasks(d.entries));
    }
  }
  return results;
}

export async function doTaskGarbageCollection(
  mode: TPortalModes,
  itemsState: StoreItemsState,
  defaultOperations: {
    factory: OperationFactory<any>;
    enabled: boolean;
  }[],
  ids: number[],
  httpClient: HttpClient,
  subscrManager: SubscriptionManager<Subscription>,
) {
  for (const key of Object.keys(itemsState.entities)) {
    const item = itemsState.entities[key]!;

    if (ids.length > 0) {
      if (item.type === 'task') {
        const task = item as StoreItemTask;

        if (ids.includes(task.id)) {
          for (let i = 0; i < task.operations.length; i++) {
            const operation = task.operations[i];
            const factory = defaultOperations[i].factory;
            if (operation.enabled && last(operation.rounds)?.status === TaskStatus.PROCESSING) {
              const opTicket = `mode[${mode}];task[${task.id}];op[${operation.id}]`;
              const opSubscriptionManager: OperationSubscriptionManager = {
                addSubscription: (subscription: Subscription, tag?: string) => {
                  subscrManager.add(subscription, tag ? `${opTicket};${tag}` : undefined);
                },
                removeByTag: (tag) => {
                  subscrManager.removeByTag(`${opTicket};${tag}`);
                },
                destroy: () => {
                  subscrManager.removeByIncludedTag(opTicket);
                },
              };

              try {
                await factory.runGarbageCollection(task, operation, httpClient, opSubscriptionManager);
              } catch (e) {
                console.error(`Couldn't run garbage collection on task with id ${task.id}`);
              } finally {
                opSubscriptionManager.destroy();
              }
            }
          }
          ids = ids.filter((id) => id !== task.id);
        }
      } else {
        // folder
        const folder = item as StoreItemTaskDirectory;
        for (const folderKey of Object.keys(folder.entries.entities)) {
          const folderItem: StoreItem = folder.entries.entities[folderKey]!;

          try {
            await doTaskGarbageCollection(mode, folderItem.entries!, defaultOperations, ids, httpClient, subscrManager);
          } catch (e) {
            // ignore
            console.error(`Couldn't run garbage collection on folder with id ${folder.id}`);
          }
        }
      }
    }
  }
}
