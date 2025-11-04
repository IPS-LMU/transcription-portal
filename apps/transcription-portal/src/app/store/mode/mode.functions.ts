import { StoreItem, StoreItemTask, StoreItemTaskDirectory } from '../store-item';

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
