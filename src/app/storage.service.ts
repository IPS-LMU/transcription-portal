import {EventEmitter, Injectable} from '@angular/core';
import {IndexedDBManager} from './obj/IndexedDBManager';
import {SubscriptionManager} from './shared/subscription-manager';
import {Task, TaskDirectory} from './obj/tasks';
import {AppInfo} from './app.info';
import {TaskEntry} from './obj/tasks/task-entry';
import {isNullOrUndefined} from 'util';
import {Operation} from './obj/tasks/operation';

@Injectable()
export class StorageService {
  private idbm: IndexedDBManager;
  private subscrmanager: SubscriptionManager = new SubscriptionManager();
  public allloaded: EventEmitter<any[]> = new EventEmitter<any[]>();

  constructor() {
    this.idbm = new IndexedDBManager('oh-portal');
    this.subscrmanager.add(this.idbm.open(1).subscribe(
      (result) => {
        console.log('open db');
        console.log(result.type);
        if (result.type === 'success') {
          // database opened
          console.log('IDB opened');
          this.idbm.save('options', 'version', {value: AppInfo.version});
          const promises = [];
          promises.push(this.idbm.get('options', 'taskCounter'));
          promises.push(this.idbm.get('options', 'operationCounter'));

          promises.push(this.idbm.getAll('tasks'));

          Promise.all(promises).then((results) => {
            TaskEntry.counter = results[0].value;
            Operation.counter = results[1].value;
            console.log(`tasks:`);
            console.log(results[2]);
            this.allloaded.emit(results[2]);
          }).catch((err) => {
            console.error(err);
            this.allloaded.emit(null);
          });

        } else if (result.type === 'upgradeneeded') {
          // database opened and needs upgrade/installation
          console.log(`IDB needs upgrade from v${result.oldVersion} to v${result.newVersion}...`);

          let version = result.oldVersion;

          // foreach step to the latest version you need to define the uprade
          // procedure
          new Promise<void>((resolve, reject) => {
            if (version === 0) {
              const promises = [];

              const optionsStore = this.idbm.db.createObjectStore('options', {keyPath: 'name'});
              promises.push(this.idbm.save(optionsStore, 'version', {value: 0}));
              promises.push(this.idbm.save(optionsStore, 'taskCounter', {value: 0}));
              promises.push(this.idbm.save(optionsStore, 'operationCounter', {value: 0}));

              Promise.all(promises).then(() => {
                version++;
                console.log(`IDB upgraded to v${version}`);
                resolve();
              }).catch((err) => {
                console.error(err);
              });
              const tasks = this.idbm.db.createObjectStore('tasks', {keyPath: 'id'});
            }
          });
        }
      },
      (error) => {
        console.error(error);
      }
    ));
  }

  public saveTask(taskEntry: Task | TaskDirectory): Promise<any> {
    console.log(`SAVE TASK`);
    const data = taskEntry.toAny();
    console.log(data);

    return this.idbm.save('tasks', taskEntry.id, data);
  }

  public saveCounter(name: string, value: number) {
    this.idbm.save('options', name, {
      value: value
    });
  }

  public removeFromDB(entry: Task | TaskDirectory): Promise<void> {
    console.log(`remove `);
    console.log(entry);
    return new Promise<void>((resolve, reject) => {
      console.log(`remove task`);
      if (entry instanceof Task) {
        if (isNullOrUndefined(entry.directory)) {
          this.idbm.remove('tasks', entry.id).then(() => {
            resolve();
          }).catch((err) => {
            reject(err);
          });
        } else {
          // file in directory
          entry.directory.removeTask(entry);
          if (entry.directory.entries.length > 1) {
            console.log(`remove task ${entry.id} from directory ${entry.directory.id}`);
            this.saveTask(entry.directory).then(() => {
              resolve();
            }).catch((err) => {
              reject(err);
            });
          } else {
            // remove empty folder
            console.log(`remove folder ${entry.directory.id}`);
            this.idbm.remove('tasks', entry.directory.id).then(() => {
              resolve();
            }).catch((err) => {
              reject(err);
            });

            if (entry.directory.entries.length === 1) {
              (<Task> entry.directory.entries[0]).directory = null;
              this.saveTask(entry.directory.entries[0]);
            }
          }
        }
      } else if (entry instanceof TaskDirectory) {
        this.idbm.remove('tasks', entry.id).then(() => {
          resolve();
        }).catch((err) => {
          reject(err);
        });
      }
    });
  }

  public destroy() {
    this.subscrmanager.destroy();
    this.idbm.close();
  }
}
