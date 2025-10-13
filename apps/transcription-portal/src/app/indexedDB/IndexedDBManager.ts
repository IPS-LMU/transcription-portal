import Dexie, { Table } from 'dexie';
import { AppInfo } from '../app.info';
import {
  IDBInternItem,
  IDBTaskItem,
  IDBUserDefaultSettingsItemData,
  IDBUserSettingsItem,
} from './types';

export class IndexedDBManager extends Dexie {
  userSettings!: Table<IDBUserSettingsItem<any>, string>;
  intern!: Table<IDBInternItem, string>;
  annotation_tasks!: Table<IDBTaskItem, number>;
  summarization_tasks!: Table<IDBTaskItem, number>;

  constructor(dbname: string) {
    super(dbname);
    this.version(2).stores({
      intern: 'name, value',
      tasks:
        'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
      userSettings: 'name, value',
    });
    this.version(3)
      .stores({
        intern: 'name, value',
        tasks:
          'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
        userSettings: 'name, value',
      })
      .upgrade((transaction) => {
        transaction
          .table('tasks')
          .toCollection()
          .modify((task: IDBTaskItem) => {
            if (Object.keys(task).includes('asr')) {
              task.operations[1].serviceProvider = (task as any)['asr'];
              delete (task as any)['asr'];
            }

            if (Object.keys(task).includes('language')) {
              task.operations[1].language = (task as any)['language'];
              delete (task as any)['language'];
            }
          });
      });
    this.version(4)
      .stores({
        intern: 'name, value',
        tasks:
          'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
        annotation_tasks:
          'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
        summarization_tasks:
          'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
        userSettings: 'name, value',
      })
      .upgrade((transaction) => {
        transaction
          .table('tasks')
          .toArray()
          .then((tasks: IDBTaskItem[]) => {
            return transaction.table('annotation_tasks').bulkAdd(tasks);
          });
      });
    this.version(5).stores({
      tasks: null,
    });
    this.version(6).stores({
      tasks: null,
      annotation_tasks: 'id, type, state, folderPath, files, operations',
      summarization_tasks: 'id, type, state, folderPath, files, operations',
    });
    this.on('populate', () => this.populate());
  }

  private async populate(): Promise<void> {
    this.userSettings.add(
      {
        name: 'defaultUserSettings',
        value: {
          asrLanguage: '',
          mausLanguage: '',
          asrProvider: '',
          summarizationWordLimit: undefined,
          summarizationProvider: '',
          translationLanguage: '',
        } as IDBUserDefaultSettingsItemData,
      },
      'defaultUserSettings',
    );
    this.intern.bulkAdd([
      {
        name: 'firstModalShown',
        value: false,
      },
      {
        name: 'operationCounter',
        value: 1,
      },
      {
        name: 'taskCounter',
        value: 1,
      },
      {
        name: 'version',
        value: AppInfo.version,
      },
    ]);
  }
}
