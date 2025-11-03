import { StoreTask } from '../task';
import { StoreTaskDirectory } from '../task-directory';

export function getIndexByEntry(selectedEntry: StoreTask | StoreTaskDirectory, entities: (StoreTask | StoreTaskDirectory)[]): number {
  let result = -1;

  for (const entry of entities) {
    if (entry.type === 'task') {
      if (entry.id === selectedEntry.id) {
        return result + 1;
      }
    } else {
      // TaskDirectory
      if (entry.id !== selectedEntry.id) {
        for (let j = 0; j < (entry as StoreTaskDirectory).entries.ids.length; j++) {
          const id = (entry as StoreTaskDirectory).entries.ids[j];
          const subEntry = (entry as StoreTaskDirectory).entries.entities[id]!;

          if (subEntry.id === selectedEntry.id) {
            return result + j + 2;
          }
        }
        result += (entry as StoreTaskDirectory).entries.ids.length;
      } else {
        return result + 1;
      }
    }
    result++;
  }

  return result;
}
