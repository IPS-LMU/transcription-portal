import Dexie, { Table } from 'dexie';
import { AppInfo } from '../app.info';

export interface IDBUserSettingsItem {
  name: string;
  value: any;
}

export interface IDBTaskItem {
  id: number;
  type: string;
  state: string;
  folderPath: string;
  asrLanguage: string;
  asrProvider: string;
  mausLanguage: string;
  files: any[];
  operations: any[];
}

export interface IDBInternItem {
  name: string;
  value: any;
}

export class IndexedDBManager extends Dexie {
  userSettings!: Table<IDBUserSettingsItem, string>;
  intern!: Table<IDBInternItem, string>;
  tasks!: Table<IDBTaskItem, number>;

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
              task.asrProvider = (task as any)['asr'];
              delete (task as any)['asr'];
            }

            if (Object.keys(task).includes('language')) {
              task.asrLanguage = (task as any)['language'];
              delete (task as any)['language'];
            }
          });
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
        },
      },
      'defaultUserSettings'
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
