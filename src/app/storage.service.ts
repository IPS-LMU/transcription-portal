import {EventEmitter, Injectable} from '@angular/core';
import {IndexedDBManager} from './obj/IndexedDBManager';
import {SubscriptionManager} from './shared/subscription-manager';
import {Operation, Task, TaskDirectory} from './obj/tasks';
import {AppInfo} from './app.info';

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
          promises.push(this.idbm.get('options', 'taskDirectoryCounter'));
          promises.push(this.idbm.get('options', 'operationCounter'));

          promises.push(this.idbm.getAll('tasks'));

          Promise.all(promises).then((results) => {
            Task.counter = results[0].value;
            TaskDirectory.counter = results[1].value;
            Operation.counter = results[2].value;
            console.log(`tasks:`);
            console.log(results[3]);
            this.allloaded.emit(results[3]);
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
              promises.push(this.idbm.save(optionsStore, 'taskDirectoryCounter', {value: 0}));
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

  public saveTask(taskEntry: Task | TaskDirectory) {
    console.log(`save Task`);
    const data = taskEntry.toAny();

    this.idbm.save('tasks', taskEntry.id, data);
  }

  public saveCounter(name: string, value: number) {
    this.idbm.save('options', name, {
      value: value
    });
  }

  public removeFromDB(entry: Task | TaskDirectory): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      console.log(`remove task`);
      if (entry instanceof Task) {
        this.idbm.remove('tasks', entry.id).then(() => {
          resolve();
        }).catch((err) => {
          reject(err);
        });
      } else if (entry instanceof TaskDirectory) {
        const promises = [];

        for (let i = 0; i < entry.entries.length; i++) {
          const entr = entry.entries[i];
          this.removeFromDB(entr);
        }
        Promise.all(promises).then(() => {
          resolve();
        }).catch((err) => {
          reject(err);
        })
      }
    });
  }

  public destroy() {
    this.subscrmanager.destroy();
    this.idbm.close();
  }
}
