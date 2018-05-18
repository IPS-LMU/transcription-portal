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
  public ready = false;
  public tasksFound = false;
  public allloaded: EventEmitter<any[]> = new EventEmitter<any[]>();

  constructor() {
    this.idbm = new IndexedDBManager('oh-portal');
    this.subscrmanager.add(this.idbm.open(2).subscribe(
      (result) => {
        console.log('open db');
        console.log(result.type);
        if (result.type === 'success') {
          // database opened
          console.log('IDB opened');
          this.idbm.count('tasks').then((count) => {
            if (count > 0) {
              this.tasksFound = true;
            }
          }).catch((error) => {
            console.error(error);
          });
          this.idbm.save('intern', 'version', {value: AppInfo.version});
          setTimeout(() => {
            const promises = [];
            promises.push(this.idbm.get('intern', 'taskCounter'));
            promises.push(this.idbm.get('intern', 'operationCounter'));

            promises.push(this.idbm.getAll('tasks'));
            promises.push(this.idbm.getAll('userSettings'));

            Promise.all(promises).then((results) => {
              TaskEntry.counter = results[0].value;
              Operation.counter = results[1].value;
              this.ready = true;
              this.allloaded.emit([results[2], results[3]]);
            }).catch((err) => {
              console.error(err);
              this.ready = true;
              this.allloaded.emit(null);
            });
          }, 500);
        } else if (result.type === 'upgradeneeded') {
          // database opened and needs upgrade/installation

          let oldVersion = result.oldVersion;

          // foreach step to the latest version you need to define the uprade
          // procedure
          new Promise<void>((resolve, reject) => {
            if (oldVersion === 0) {
              const promises = [];

              const optionsStore = this.idbm.db.createObjectStore('intern', {keyPath: 'name'});
              promises.push(this.idbm.save(optionsStore, 'version', {value: 0}));
              promises.push(this.idbm.save(optionsStore, 'taskCounter', {value: 0}));
              promises.push(this.idbm.save(optionsStore, 'operationCounter', {value: 0}));

              Promise.all(promises).then(() => {
                oldVersion++;
                console.log(`IDB upgraded to v${oldVersion}`);
                resolve();
              }).catch((err) => {
                console.error(err);
                reject(err);
              });
              this.idbm.db.createObjectStore('tasks', {keyPath: 'id'});
            } else {
              // skip update to 1
              resolve();
            }
          }).then(
            () => {
              return new Promise<void>((resolve) => {
                if (oldVersion === 1) {
                  console.log(`UPDATE TO 2!`);
                  this.idbm.db.createObjectStore('userSettings', {keyPath: 'name'});
                  oldVersion++;
                  resolve();
                } else {
                  // skip update to 2
                  resolve();
                }
              });
            }
          ).catch((err) => {
            console.error(`update to db v1 failed`);
            console.error(err);
          });
        }
      },
      (error) => {
        console.error(error);
      }
    ));
  }

  public saveTask(taskEntry: Task | TaskDirectory): Promise<void> {
    console.log(`saveTask ${taskEntry.id}`);
    return new Promise<void>((resolve, reject) => {
      let promise: Promise<any>;

      if (taskEntry instanceof Task && !isNullOrUndefined(taskEntry.directory)) {
        promise = taskEntry.directory.toAny();
      } else {
        promise = taskEntry.toAny();
      }

      promise.then((data) => {
        console.log(`save!!!!`);
        this.idbm.save('tasks', data.id, data).then(() => {
          resolve();
        }).catch((error) => {
          reject(error);
        });
      }).catch((error) => {
        reject(error);
      });
    });
  }

  public saveCounter(name: string, value: number) {
    this.idbm.save('intern', name, {
      value: value
    });
  }

  public saveIntern(name: string, value: any) {
    this.idbm.save('intern', name, {
      value: value
    });
  }

  public saveUserSettings(name: string, value: any) {
    this.idbm.save('userSettings', name, {
      value: value
    });
  }

  public removeFromDB(entry: Task | TaskDirectory): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
            this.saveTask(entry.directory).then(() => {
              resolve();
            }).catch((err) => {
              reject(err);
            });
          } else {
            resolve();
          }
        }
      } else {
        console.log(`remove DIR! ${entry.id}`);
        this.idbm.remove('tasks', entry.id).then(() => {
          console.log(`dir rem ${entry.id}`);
          resolve();
        }).catch((err) => {
          reject(err);
        });
      }
    });
  }

  public getIntern(name: string) {
    return this.idbm.get('intern', name);
  }

  public destroy() {
    this.subscrmanager.destroy();
    this.idbm.close();
  }
}
