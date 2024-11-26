import { Injectable } from '@angular/core';
import { SubscriptionManager } from '@octra/utilities';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AppInfo } from './app.info';
import {
  IDBInternItem,
  IDBTaskItem,
  IDBUserSettingsItem,
  IndexedDBManager,
} from './obj/IndexedDBManager';
import { Operation } from './obj/operations/operation';
import { Task, TaskDirectory } from './obj/tasks';
import { TaskEntry } from './obj/tasks/task-entry';

@Injectable({ providedIn: 'root' })
export class StorageService {
  get idbm(): IndexedDBManager {
    return this._idbm;
  }

  public ready = false;
  public tasksFound = false;
  public allloaded = new BehaviorSubject<{
    tasks: IDBTaskItem[];
    userSettings: IDBUserSettingsItem[];
  }>({
    tasks: [],
    userSettings: [],
  });
  private _idbm: IndexedDBManager;
  private subscrmanager = new SubscriptionManager<Subscription>();

  private userProfile = {
    name: '',
    email: '',
  };

  public get userEmail(): string {
    return this.userProfile.email;
  }

  public set userEmail(value: string) {
    this.userProfile.email = value;
    this.idbm.userSettings.put({
      name: 'userProfile',
      value: this.userProfile,
    });
  }

  public get userName(): string {
    return this.userProfile.name;
  }

  public set userName(value: string) {
    this.userProfile.name = value;
    this.idbm.userSettings.put({
      name: 'userProfile',
      value: this.userProfile,
    });
  }

  constructor() {
    this._idbm = new IndexedDBManager('oh-portal');
    this._idbm.open().catch((e) => {
      alert(e.message);
    });
    this._idbm.on('ready', async () => {
      console.log('IDB ready.');
      const tasksCount = await this._idbm.tasks.count();
      this.tasksFound = tasksCount > 0;
      this._idbm.intern.put({
        name: 'version',
        value: AppInfo.version,
      });

      const promises = [];
      promises.push(this._idbm.intern.get('taskCounter'));
      promises.push(this._idbm.intern.get('operationCounter'));

      promises.push(this._idbm.tasks.toArray());
      promises.push(this._idbm.userSettings.toArray());

      Promise.all<
        [IDBInternItem, IDBInternItem, IDBTaskItem[], IDBUserSettingsItem[]]
      >(promises as any)
        .then(([taskCounter, operationCounter, tasks, userSettings]) => {
          TaskEntry.counter = taskCounter.value;
          Operation.counter = operationCounter.value;
          this.ready = true;

          if (userSettings) {
            const userProfile = userSettings.find((a: any) => {
              return a.name === 'userProfile';
            });

            if (userProfile && userProfile.value) {
              this.userProfile = userProfile.value;
            }
          }

          this.allloaded.next({
            tasks,
            userSettings,
          });
          this.allloaded.complete();
        })
        .catch((err) => {
          console.error(err);
          this.ready = true;
          this.allloaded.next({
            tasks: [],
            userSettings: [],
          });
          this.allloaded.complete();
        });
    });
  }

  public saveTask(taskEntry: Task | TaskDirectory): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let promise: Promise<any>;

      if (
        taskEntry instanceof Task &&
        !(taskEntry.directory === null || taskEntry.directory === undefined)
      ) {
        promise = taskEntry.directory.toAny();
      } else {
        promise = taskEntry.toAny();
      }

      promise
        .then((data) => {
          this.idbm.tasks
            .put(data)
            .then(() => {
              resolve();
            })
            .catch((error) => {
              reject(error);
            });
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  public saveCounter(name: string, value: number) {
    this.idbm.intern.put({
      name,
      value,
    });
  }

  public saveIntern(name: string, value: any) {
    this.idbm.intern.put({
      name,
      value,
    });
  }

  public saveUserSettings(name: string, value: any) {
    this.idbm.userSettings.put({
      name,
      value,
    });
  }

  public removeFromDB(entry: Task | TaskDirectory): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (entry instanceof Task) {
        if (entry.directory === null || entry.directory === undefined) {
          this.idbm.tasks
            .delete(entry.id)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
        } else {
          // file in directory
          entry.directory.removeTask(entry);
          if (entry.directory.entries.length > 1) {
            this.saveTask(entry.directory)
              .then(() => {
                resolve();
              })
              .catch((err) => {
                reject(err);
              });
          } else {
            resolve();
          }
        }
      } else {
        this.idbm.tasks
          .delete(entry.id)
          .then(() => {
            resolve();
          })
          .catch((err) => {
            reject(err);
          });
      }
    });
  }

  public getIntern(name: string) {
    return this.idbm.intern.get(name);
  }

  public destroy() {
    this.subscrmanager.destroy();
  }

  public clearAll() {
    this._idbm.delete({
      disableAutoOpen: true,
    });
    window.location.reload();
  }
}
