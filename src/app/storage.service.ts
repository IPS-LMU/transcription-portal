import {Injectable} from '@angular/core';
import {IndexedDBManager} from './obj/IndexedDBManager';
import {SubscriptionManager} from './shared/subscription-manager';
import {Task, TaskDirectory} from './obj/tasks';
import {AppInfo} from './app.info';

@Injectable()
export class StorageService {
  public allloaded = false;
  private idbm: IndexedDBManager;
  private subscrmanager: SubscriptionManager = new SubscriptionManager();

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
        } else if (result.type === 'upgradeneeded') {
          // database opened and needs upgrade/installation
          console.log(`IDB needs upgrade from v${result.oldVersion} to v${result.newVersion}...`);

          let version = result.oldVersion;

          // foreach step to the latest version you need to define the uprade
          // procedure
          new Promise<void>((resolve, reject) => {
            if (version === 0) {
              const optionsStore = this.idbm.db.createObjectStore('options', {keyPath: 'name'});
              this.idbm.save(optionsStore, 'version', {value: 1}).then(() => {
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
    /* console.log(`save Task`);
    const data = taskEntry.toAny();

    this.idbm.save('tasks', taskEntry.id, data);*/
  }

  public destroy() {
    this.subscrmanager.destroy();
    this.idbm.close();
  }
}
