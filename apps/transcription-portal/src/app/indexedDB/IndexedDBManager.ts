import Dexie, { Table } from 'dexie';
import { AppInfo } from '../app.info';
import { IDBInternItem, IDBTaskItem, IDBUserDefaultSettingsItemData, IDBUserSettingsItem } from './types';
import { IASROperation } from '../obj/operations/asr-operation';

export class IndexedDBManager extends Dexie {
  userSettings!: Table<IDBUserSettingsItem<any>, string>;
  intern!: Table<IDBInternItem, string>;
  annotation_tasks!: Table<IDBTaskItem, number>;
  summarization_tasks!: Table<IDBTaskItem, number>;

  constructor(dbname: string) {
    super(dbname);
    this.version(2).stores({
      intern: 'name, value',
      tasks: 'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
      userSettings: 'name, value',
    });
    this.version(3)
      .stores({
        intern: 'name, value',
        tasks: 'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
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
              (task.operations[1] as IASROperation).language = (task as any)['language'];
              delete (task as any)['language'];
            }
          });
      });
    // create task tables for annotation and summarization
    this.version(4)
      .stores({
        intern: 'name, value',
        tasks: 'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
        annotation_tasks: 'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
        summarization_tasks: 'id, type, state, folderPath, asrLanguage, asrProvider, mausLanguage, files, operations',
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
    // remove old tasks table
    this.version(5).stores({
      tasks: null,
    });
    // remove tasks table and columns asrLanguage, asrProvider, mausLanguage
    this.version(6).stores({
      tasks: null,
      annotation_tasks: 'id, type, state, folderPath, files, operations',
      summarization_tasks: 'id, type, state, folderPath, files, operations',
    });
    // in version 7 we start to use proceedings rounds.
    this.version(7).upgrade(async (transaction: Transaction) => {
      const affectedTableNames = ['annotation_tasks', 'summarization_tasks'];
      for (const affectedTableName of affectedTableNames) {
        await transaction
          .table<IDBTaskItem, number>(affectedTableName)
          .toCollection()
          .modify((task: IDBTaskItem) => {
            // wrap results with ProceedingRounds
            for (const operation of task.operations) {
              const rounds: OperationProcessingRoundSerialized[] = [];

              if (operation.name === 'Upload') {
                // results to one round
                rounds.push({
                  protocol: (operation as any).protocol,
                  results: (operation as any).results,
                  status: (operation as any).state,
                  time: (operation as any).time,
                });
              } else {
                // other operation: each results is equal to one round
                for (const result of (operation as any).results) {
                  rounds.push({
                    protocol: (operation as any).protocol,
                    results: [result],
                    status: (operation as any).state,
                    time: (operation as any).time,
                  });
                }
              }

              operation.rounds = rounds;
              delete (operation as any)["results"];
              delete (operation as any)["protocol"];
              delete (operation as any)["state"];
              delete (operation as any)["time"];
            }
          });
      }
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
          diarization: false,
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

  async backup() {
    const blob = await exportDB(this);
    return URL.createObjectURL(blob);
  }

  async importBackup(backupFile: Blob) {
    await importInto(this, backupFile, {
      clearTablesBeforeImport: true
    });
    document.location.reload();
  }
}
