import {EventEmitter, Injectable} from '@angular/core';
import {IndexedDBManager} from './obj/IndexedDBManager';
import {SubscriptionManager} from './shared/subscription-manager';
import {Task, TaskDirectory} from './obj/tasks';
import {AppInfo} from './app.info';
import {TaskEntry} from './obj/tasks/task-entry';
import {Operation} from './obj/operations/operation';

@Injectable()
export class StorageService {
  public ready = false;
  public tasksFound = false;
  public allloaded: EventEmitter<any[]> = new EventEmitter<any[]>();
  private idbm: IndexedDBManager;
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

  private userProfile = {
    name: '',
    email: ''
  };

  public get userEmail(): string {
    return this.userProfile.email;
  }

  public set userEmail(value: string) {
    this.userProfile.email = value;
    this.idbm.save('userSettings', 'userProfile', {value: this.userProfile});
  }

  public get userName(): string {
    return this.userProfile.name;
  }

  public set userName(value: string) {
    this.userProfile.name = value;
    this.idbm.save('userSettings', 'userProfile', {value: this.userProfile});
  }

  constructor() {
    this.idbm = new IndexedDBManager('oh-portal');
    this.subscrmanager.add(this.idbm.open(2).subscribe(
      (result) => {
        console.log('open db');
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

              if (results[3]) {
                const userProfile = results[3].find((a: any) => {
                  return a.name === 'userProfile';
                });

                if (userProfile && userProfile.value) {
                  this.userProfile = userProfile.value;
                }
              }

              this.allloaded.emit([results[2], results[3]]);
            }).catch((err) => {
              console.error(err);
              this.ready = true;
              this.allloaded.emit();
            });
          }, 500);
        } else if (result.type === 'upgradeneeded') {
          // database opened and needs upgrade/installation

          let oldVersion = result.oldVersion;

          // foreach step to the latest version you need to define the uprade
          // procedure
          if (this.idbm.db) {
            new Promise<void>((resolve, reject) => {
              if (this.idbm.db) {
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
              }
            }).then(
              () => {
                return new Promise<void>((resolve) => {
                  if (this.idbm.db) {
                    if (oldVersion === 1) {
                      console.log(`UPDATE TO 2!`);
                      this.idbm.db.createObjectStore('userSettings', {keyPath: 'name'});
                      oldVersion++;
                      resolve();
                    } else {
                      // skip update to 2
                      resolve();
                    }
                  }
                });
              }
            ).catch((err) => {
              console.error(`update to db v1 failed`);
              console.error(err);
            });
          }
        }
      },
      (error) => {
        console.error(error);
      }
    ));
  }

  public saveTask(taskEntry: Task | TaskDirectory): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let promise: Promise<any>;

      if (taskEntry instanceof Task && !(taskEntry.directory === null || taskEntry.directory === undefined)) {
        promise = taskEntry.directory.toAny();
      } else {
        promise = taskEntry.toAny();
      }

      promise.then((data) => {
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
      value
    });
  }

  public saveIntern(name: string, value: any) {
    this.idbm.save('intern', name, {
      value
    });
  }

  public saveUserSettings(name: string, value: any) {
    this.idbm.save('userSettings', name, {
      value
    });
  }

  public removeFromDB(entry: Task | TaskDirectory): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (entry instanceof Task) {
        if ((entry.directory === null || entry.directory === undefined)) {
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
        this.idbm.remove('tasks', entry.id).then(() => {
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
  }

  public clearAll() {
    this.idbm.removeDatabase('oh-portal');
    window.location.reload();
  }
}
