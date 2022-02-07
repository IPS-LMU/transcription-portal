import {Observable} from 'rxjs';
import {hasProperty} from '@octra/utilities';

export enum IDBMode {
  READONLY,
  READWRITE
}

export class IndexedDBManager {
  private indexedDB?: IDBFactory;
  private readonly _idbtransaction?: IDBTransaction;
  private idbkeyrange?: IDBKeyRange;
  private readonly dbname: string;

  constructor(dbname: string) {
    this.dbname = dbname;

    if (!IndexedDBManager.isCompatible()) {
      console.error('Browser doesn\'t support a stable version of IndexedDB.');
    } else {
      this.indexedDB = window.indexedDB
        || (window as any).mozIndexedDB
        || (window as any).webkitIndexedDB
        || (window as any).msIndexedDB;

      this._idbtransaction = (window as any).IDBTransaction
        || (window as any).webkitIDBTransaction
        || (window as any).msIDBTransaction;

      this.idbkeyrange = (window as any).IDBKeyRange
        || (window as any).webkitIDBKeyRange
        || (window as any).msIDBKeyRange;
    }
  }

  get idbtransaction(): IDBTransaction | undefined {
    return this._idbtransaction;
  }

  private _db?: IDBDatabase;

  get db(): IDBDatabase | undefined {
    return this._db;
  }

  /***
   * checks if browser supports indexedDB
   */
  public static isCompatible(): boolean {
    const indexedDB = (window as any).indexedDB
      || (window as any).mozIndexedDB
      || (window as any).webkitIndexedDB
      || (window as any).msIndexedDB;

    const idbtransaction = (window as any).IDBTransaction
      || (window as any).webkitIDBTransaction
      || (window as any).msIDBTransaction;

    const idbkeyrange = (window as any).IDBKeyRange
      || (window as any).webkitIDBKeyRange
      || (window as any).msIDBKeyRange;

    return (!((indexedDB === null || indexedDB === undefined)
      || (idbtransaction === null || idbtransaction === undefined)
      || (idbkeyrange === null || idbkeyrange === undefined)));
  }

  public open(version?: number): Observable<any> {
    if (!this.indexedDB) {
      throw new Error('indexDB is undefined');
    }
    const request = this.indexedDB.open(this.dbname, version);
    return new Observable(observer => {
      request.onerror = (event: any) => {
        observer.error(event);
      };

      request.onsuccess = (event: any) => {
        this._db = event.target.result;
        observer.next(event);
        observer.complete();
      };

      request.onupgradeneeded = (event: any) => {
        this._db = event.target.result;
        observer.next(event);
      };

      request.onblocked = (event: any) => {
        observer.next(event);
      };
    });
  }

  public getObjectStore = (storeName: string, mode: IDBMode): IDBObjectStore => {
    if (!this.db) {
      throw new Error('db is undefined');
    }
    let modeStr: IDBTransactionMode = 'readonly';

    if (mode === IDBMode.READWRITE) {
      modeStr = 'readwrite';
    }
    const txn = this.db.transaction([storeName], modeStr);
    return txn.objectStore(storeName);
  }

  public objectStoreExists = (storeName: string): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      if (!this.db) {
        throw new Error('db is undefined');
      }

      const modeStr: IDBTransactionMode = 'readonly';

      const txn = this.db.transaction([storeName], modeStr);
      txn.onerror = () => {
        reject();
      };
      txn.oncomplete = () => {
        resolve();
      };
    });
  }

  public get = (storeName: string | IDBObjectStore, key: string | number): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READONLY);
        if (key !== null && key !== undefined) {
          const request: IDBRequest = store.get(key);
          request.onsuccess = (idbrequest: any) => {
            resolve(idbrequest.target.result);
          };

          request.onerror = (error: any) => {
            reject(error);
          };
        } else {
          reject(new Error('key not defined'));
        }
      }
    );
  }

  public getAll = (storeName: string | IDBObjectStore): Promise<any[]> => {
    return new Promise<any>(
      (resolve, reject) => {
        const result: any[] = [];
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READONLY);
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = (event: any) => {
          const cursor = event.target.result;

          if (cursor) {
            const value = cursor.value;
            result.push(value);
            cursor.continue();
          } else {
            resolve(result);
          }
        };

        cursorRequest.onerror = (error: any) => {
          reject(error);
        };
      }
    );
  }

  public save = (storeName: string | IDBObjectStore, key: string, data: any): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        try {
          const store: IDBObjectStore = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);

          if (data === null || data === undefined) {
            data = {};
          }
          // make sure that key is in data object
          if (!hasProperty(data, Array.isArray(store.keyPath) ? store.keyPath.join('.') : store.keyPath)) {
            data['' + store.keyPath + ''] = key;
          }
          const request = key ? store.put(data) : store.add(data);
          request.onsuccess = (result: any) => {
            resolve(result);
          };
          request.onerror = (error: any) => {
            reject(error);
          };
        } catch (error) {
          reject(error);
        }
      }
    );
  }

  public remove = (storeName: string | IDBObjectStore, key: string | number): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);
        const request = store.delete(key);
        request.onsuccess = (result: any) => {
          resolve(result);
        };

        request.onerror = (error: any) => {
          reject(error);
        };
      });
  }

  public clear = (storeName: string | IDBObjectStore): Promise<any> => {
    return new Promise<any>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);
        const request = store.clear();
        request.onsuccess = (result: any) => {
          resolve(result);
        };

        request.onerror = (error: any) => {
          reject(error);
        };
      });
  }

  public close = () => {
    this.db?.close();
  }

  public saveArraySequential = (array: any[], storeName: string | IDBObjectStore, key: any): Promise<void> => {
    return new Promise<void>(
      (resolve, reject) => {
        const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READWRITE);

        const wrapper = (acc: number) => {
          if (acc < array.length) {
            const value = (typeof key === 'string') ? array[acc]['' + key + ''] : array[acc][key];
            this.save(store, value, array[acc]).then(
              () => {
                wrapper(++acc);
              }
            ).catch((err) => {
              reject(err);
            });
          } else {
            resolve();
          }
        };
        wrapper(0);
      }
    );
  }

  public removeDatabase(database: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (!this.indexedDB) {
        throw new Error('indexedDB');
      }
      const req = this.indexedDB.deleteDatabase(database);

      req.onsuccess = () => {
        resolve();
      };
      req.onerror = () => {
        reject('Couldn\'t delete database');
      };
      req.onblocked = () => {
        reject('Couldn\'t delete database due to the operation being blocked');
      };
    });
  }

  public count(storeName: string | IDBObjectStore): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      const store = (typeof storeName !== 'string') ? storeName : this.getObjectStore(storeName, IDBMode.READONLY);

      const countRequest = store.count();
      countRequest.onsuccess = () => {
        resolve(countRequest.result);
      };
      countRequest.onerror = reject;
    });
  }
}
