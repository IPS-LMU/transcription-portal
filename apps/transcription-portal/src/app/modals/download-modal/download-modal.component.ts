import {Component, Input, OnInit, TemplateRef, ViewChild} from '@angular/core';
import {Task, TaskDirectory, TaskState} from '../../obj/tasks';
import {Operation} from '../../obj/operations/operation';
import {AppInfo} from '../../app.info';
import {UploadOperation} from '../../obj/operations/upload-operation';
import {FileInfo} from '@octra/utilities';
import {EmuOperation} from '../../obj/operations/emu-operation';
import {TaskService} from '../../obj/tasks/task.service';
import {HttpClient} from '@angular/common/http';
import {StorageService} from '../../storage.service';
import * as moment from 'moment';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {BsModalRef, BsModalService} from 'ngx-bootstrap/modal';
import {DownloadService} from '../../shared/download.service';
import * as JSZip from 'jszip';

@Component({
  selector: 'tportal-download-modal',
  templateUrl: './download-modal.component.html',
  styleUrls: ['./download-modal.component.css']
})
export class DownloadModalComponent implements OnInit {

  @ViewChild('content', {static: true}) content?: TemplateRef<any>;
  @Input() type: 'line' | 'column' = 'column';
  private selectedTasks?: number[];
  @Input() taskList?: Task[];
  @Input() column?: Operation;

  downloadModal?: BsModalRef;

  public archiveURL: SafeResourceUrl = '';
  public archiveName = '';
  public checkboxes: boolean[] = [];

  public state = 'inactive';

  private subscrManager = new SubscriptionManager();

  constructor(private taskService: TaskService, private http: HttpClient, private storage: StorageService,
              private modalService: BsModalService, private sanitizer: DomSanitizer, private downloadService: DownloadService) {

  }

  public get converters() {
    return AppInfo.converters;
  }

  ngOnInit() {
    this.checkboxes = [];

    for (const converter of AppInfo.converters) {
      this.checkboxes.push(false);
    }
  }

  uncheckAll() {
    for (let i = 0; i < this.checkboxes.length; i++) {
      this.checkboxes[i] = false;
    }
  }

  public open(type: 'column' | 'line', selectedTasks: number[]) {
    this.uncheckAll();
    this.type = type;
    this.selectedTasks = selectedTasks;

    this.subscrManager.add(this.modalService.onHidden.subscribe((e) => {
      this.state = 'inactive';
    }));

    this.downloadModal = this.modalService.show(this.content);
  }

  process() {
    this.state = 'processing';
    if (this.type === 'column' && !(this.column instanceof UploadOperation || this.column instanceof EmuOperation)) {
      this.doColumnZipping();
    } else if (this.type === 'line') {
      this.doLineZipping();
    }
  }

  doColumnZipping() {
    if (!this.taskService.taskList) {
      throw new Error('taskList is undefined');
    }
    // get url for resulty by column
    // prepare package
    const dateStr = moment().format('YYYY-MM-DD_H-mm-ss');
    const requestPackage: {
      entries: {
        path: string,
        file: File
      }[]
    } = {
      entries: []
    };
    const tasks = this.taskService.taskList.getAllTasks();

    const promises: Promise<void>[] = [];

    const opIndex = this.taskService.operations.findIndex((a) => {
      if (!this.column) {
        throw new Error('column is undefined');
      }
      return a.name === this.column.name;
    });

    if (opIndex > -1) {
      // operation found

      for (const task of tasks) {
        const operation = task.operations[opIndex];

        if (operation.results.length > 0 && operation.state === TaskState.FINISHED) {
          const result: FileInfo | undefined = operation.lastResult;
          if (result?.online) {
            requestPackage.entries.push({
              path: result.fullname,
              file: result.file
            });


            const selectedConverters = AppInfo.converters.filter((a, i) => {
              return this.checkboxes[i];
            });

            const promise = new Promise<void>((resolve, reject) => {
              this.downloadService.getConversionFiles(operation, result, selectedConverters).then((files) => {
                files = files.filter(a => a);
                for (const fileInfo of files) {
                  requestPackage.entries.push({
                    path: fileInfo.file.name,
                    file: fileInfo.file
                  });
                }
                resolve();
              }).catch((error) => {
                reject(error);
              });
            });

            promises.push(promise);
          }
        }
      }
    } else {
      console.error('opIndex is less than 0!');
    }

    // TODO check if this is required
    new Promise<void>((resolve, reject) => {
      if (promises.length === 0) {
        resolve();
      } else {
        Promise.all(promises).then(() => {
            resolve();
          },
          (error) => {
            reject(error);
          });
      }
    }).then(() => {
      if (requestPackage.entries.length > 0) {
        this.archiveName = `${this.column?.name}Results_${dateStr}`;
        this.doZipping(requestPackage.entries);
      } else {
        this.state = 'inactive';
        this.archiveURL = '';
      }
    }).catch((error) => {
      console.error(error);
    });
  }

  doLineZipping() {
    // get results url by lines
    if (!(this.selectedTasks === null || this.selectedTasks === undefined)) {
      // prepare package
      const dateStr = moment().format('YYYY-MM-DD_H-mm-ss');
      const requestPackage: {
        entries: {
          path: string,
          file: File
        }[]
      } = {
        entries: []
      };

      this.archiveName = `transcription-portal_results_${dateStr}`;

      const promises = [];

      for (const index of this.selectedTasks) {
        const entry = this.taskService.taskList?.getEntryByIndex(index);

        if (entry instanceof TaskDirectory) {

          promises.push(new Promise<void>((resolve, reject) => {
            const dirPromises = [];

            for (const dirEntry of entry.entries) {
              dirPromises.push(this.processTask(dirEntry as Task));
            }

            Promise.all(dirPromises).then((values) => {
              for (const value of values) {
                for (const val of value) {
                  val.path = `${entry.foldername}/${val.path}` as never;
                  requestPackage.entries.push(val);
                }
              }
              resolve();
            }).catch((error) => {
              console.error(error);
            });
          }));
        } else {
          // task
          if (entry) {
            promises.push(
              new Promise<void>((resolve, reject) => {
                this.processTask(entry).then((entries) => {
                  for (const entry2 of entries) {
                    requestPackage.entries.push(entry2);
                  }
                  resolve();
                }).catch((error) => {
                  console.error(error);
                  reject(error);
                });
              }));
          }
        }
      }

      Promise.all(promises).then(() => {
        this.doZipping(requestPackage.entries);
      }).catch((error) => {
        this.state = 'error';
        console.error(error);
      });
    }
  }

  processTask(task: Task): Promise<{
    path: 'string',
    file: File
  }[]> {
    return new Promise<any>((resolve, reject) => {
      if (!(task === null || task === undefined)) {

        // single task
        const entryResult: {
          path: string,
          file: File | undefined
        }[] = [];

        const promises = [];
        for (let j = 1; j < task.operations.length; j++) {
          const operation = task.operations[j];

          if (operation.name !== task.operations[0].name && operation.state === TaskState.FINISHED && operation.results.length > 0) {
            const opResult = operation.lastResult;
            const folderName = this.getFolderName(operation);
            entryResult.push({
              path: `${task.files[0].name}/${folderName}/${opResult?.file.name}`,
              file: opResult?.file
            });

            const selectedConverters = AppInfo.converters.filter((a, i) => {
              return this.checkboxes[i];
            });

            promises.push(new Promise<void>((resolve2, reject2) => {
              this.downloadService.getConversionFiles(operation, operation.lastResult, selectedConverters).then((entries) => {
                const folderName2 = this.getFolderName(operation);
                entries = entries.filter(a => a);

                for (const entry of entries) {
                  entryResult.push({
                    path: `${task.files[0].name}/${folderName2}/${entry.fullname}`,
                    file: entry.file
                  });
                }
                resolve2();
              }).catch((error) => {
                reject2(error);
              });
            }));
          }
        }

        Promise.all(promises).then(() => {
          resolve(entryResult);
        }).catch((error) => {
          reject(error);
        });
      } else {
        reject('task is null or undefined');
      }
    });
  }

  doZipping(entries: {
    path: string,
    file: File
  }[]) {
    const zip = new JSZip();

    for (const entry of entries) {
      zip.file(entry.path, entry.file);
    }

    zip.generateAsync({type: 'base64'}).then((base64) => {
      this.archiveURL = this.sanitizer.bypassSecurityTrustResourceUrl('data:application/zip;base64,' + base64);
      this.state = 'finished';
    });
  }

  removeSelected() {
    if (this.selectedTasks && this.taskService.taskList) {
      for (const index of this.selectedTasks) {
        const entry = this.taskService.taskList.getEntryByIndex(index);
        if (entry) {
          this.taskService.taskList.removeEntry(entry, true);
        } else {
          throw new Error('Can\'t find entry');
        }
      }
      this.downloadModal?.hide();
    }
  }

  getFolderName(operation: Operation) {
    switch (operation.name) {
      case ('ASR'):
        return '1_Speech Recognition';
      case ('OCTRA'):
        return '2_Manual Transcription';
      case ('MAUS'):
        return '3_Word Alignment';
      case ('Emu WebApp'):
        return '4_Phonetic Detail';
    }

    return '';
  }
}
