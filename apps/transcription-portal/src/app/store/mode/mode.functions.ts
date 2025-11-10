import { StoreItem, StoreItemsState, StoreItemTask, StoreItemTaskDirectory } from '../store-item';

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
