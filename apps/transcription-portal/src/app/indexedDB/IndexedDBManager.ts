import Dexie, { Table, Transaction } from 'dexie';
import { exportDB, importDB } from 'dexie-export-import';
import { AppInfo } from '../app.info';
import { IASROperation, IDBFolderItem, IDBInternItem, IDBTaskItem, IDBUserDefaultSettingsItemData, IDBUserSettingsItem } from './types';
import { OperationProcessingRoundSerialized } from '../store';

export class IndexedDBManager extends Dexie {
  userSettings!: Table<IDBUserSettingsItem<any>, string>;
  intern!: Table<IDBInternItem, string>;
  annotation_tasks!: Table<IDBTaskItem | IDBFolderItem, number>;
  summarization_tasks!: Table<IDBTaskItem | IDBFolderItem, number>;

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
          .modify((entry: IDBTaskItem | IDBFolderItem) => {
            const changeTask = (task: IDBTaskItem) => {
              if (Object.keys(task).includes('asr')) {
                task.operations[1].serviceProvider = (task as any)['asr'];
                delete (task as any)['asr'];
              }

              if (Object.keys(task).includes('language')) {
                (task.operations[1] as IASROperation).language = (task as any)['language'];
                delete (task as any)['language'];
              }
            };

            if (entry.type === 'task') {
              changeTask(entry);
            } else {
              for (const task of (entry as IDBFolderItem).entries) {
                changeTask(task);
              }
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
      .upgrade(async (transaction) => {
        await transaction
          .table('tasks')
          .toArray()
          .then((tasks: IDBTaskItem[]) => {
            return transaction.table('annotation_tasks').bulkAdd(tasks);
          });
        await transaction
          .table<IDBTaskItem, number>('annotation_tasks')
          .toCollection()
          .modify((entry: IDBTaskItem | IDBFolderItem) => {
            const changeTask = (task: any) => {
              (task as IDBTaskItem).operations[0].serviceProvider = 'BAS';
              if (task.asrLanguage) {
                ((task as IDBTaskItem).operations[1] as IASROperation).language = task.asrLanguage;
              }

              if (task.asrProvider) {
                ((task as IDBTaskItem).operations[1] as IASROperation).serviceProvider = task.asrProvider;
              }

              (task as IDBTaskItem).operations[2].serviceProvider = 'BAS';

              if (task.mausLanguage) {
                ((task as IDBTaskItem).operations[3] as IASROperation).language = task.asrLanguage;
              }

              (task as IDBTaskItem).operations[4].serviceProvider = 'BAS';
            };

            if (entry.type === 'task') {
              changeTask(entry);
            } else {
              for (const task of (entry as any).entries) {
                changeTask(task);
              }
            }
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
          .modify((entry: IDBTaskItem | IDBFolderItem) => {
            const changeTask = (task: any) => {
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
                  for (let i = 0; i < (operation as any).results.length; i++) {
                    const result = (operation as any).results[i];
                    const time = i === (operation as any).results.length - 1 ? (operation as any).time : undefined;

                    rounds.push({
                      protocol: (operation as any).protocol,
                      results: [result],
                      status: (operation as any).state,
                      time,
                    });
                  }
                }

                operation.rounds =
                  rounds.length > 0
                    ? rounds
                    : [
                        {
                          results: [],
                          status: (operation as any).state,
                        },
                      ];

                if (!operation.serviceProvider) {
                  if (operation.name === 'Translation') {
                    operation.serviceProvider = 'LibreTranslate';
                  } else if (operation.name === 'Summarization') {
                    operation.serviceProvider = 'LSTSummarization';
                  } else if (['Upload', 'OCTRA', 'Emu WebApp'].includes(operation.name)) {
                    operation.serviceProvider = 'BAS';
                  } else if (operation.name === 'MAUS') {
                    operation.serviceProvider = 'BAS';
                  }
                }

                delete (operation as any)['results'];
                delete (operation as any)['protocol'];
                delete (operation as any)['state'];
                delete (operation as any)['time'];
              }
            };

            if (entry.type === 'task') {
              changeTask(entry);
            } else {
              for (const task of (entry as any).entries) {
                changeTask(task);
              }
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
    await this.delete({
      disableAutoOpen: true,
    });
    await importDB(backupFile, {
      name: this.name,
    });
    document.location.reload();
  }
}

export default IndexedDBManager;
