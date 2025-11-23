import { NgStyle, UpperCasePipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgbActiveModal, NgbModalOptions } from '@ng-bootstrap/ng-bootstrap';
import { SubscriberComponent } from '@octra/ngx-utilities';
import * as JSZip from 'jszip';
import { DateTime } from 'luxon';
import { AppInfo } from '../../app.info';
import { EmuOperation } from '../../obj/operations/emu-operation';
import { Operation, OperationProcessingRound } from '../../obj/operations/operation';
import { UploadOperation } from '../../obj/operations/upload-operation';
import { Task, TaskDirectory, TaskStatus } from '../../obj/tasks';
import { TaskService } from '../../obj/tasks/task.service';
import { DownloadService } from '../../shared/download.service';

@Component({
  selector: 'tportal-download-modal',
  templateUrl: './download-modal.component.html',
  styleUrls: ['./download-modal.component.scss'],
  imports: [FormsModule, NgStyle, TranslocoPipe, UpperCasePipe],
})
export class DownloadModalComponent extends SubscriberComponent implements OnInit {
  private taskService = inject(TaskService);
  protected activeModal = inject(NgbActiveModal);
  private sanitizer = inject(DomSanitizer);
  private downloadService = inject(DownloadService);

  type: 'line' | 'column' = 'column';
  private selectedTasks?: number[];
  taskList?: Task[];
  column?: Operation;

  public static options: NgbModalOptions = {
    size: 'md',
    backdrop: 'static',
  };

  public archiveURL: SafeResourceUrl = '';
  public archiveName = '';
  public checkboxes: boolean[] = [];

  showRemoveLine = false;

  public state = 'inactive';

  public get converters() {
    return AppInfo.converters;
  }

  ngOnInit() {
    this.checkboxes = [];

    AppInfo.converters.forEach(() => {
      this.checkboxes.push(false);
    });
  }

  uncheckAll() {
    for (let i = 0; i < this.checkboxes.length; i++) {
      this.checkboxes[i] = false;
    }
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
    if (!this.taskService.state.currentModeState.taskList) {
      throw new Error('taskList is undefined');
    }
    // get url for resulty by column
    // prepare package
    const dateStr = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss');
    const requestPackage: {
      entries: {
        path: string;
        file: File;
      }[];
    } = {
      entries: [],
    };
    const tasks = this.taskService.state.currentModeState.taskList.getAllTasks();

    const promises: Promise<void>[] = [];

    const opIndex = this.taskService.state.currentModeState.operations.findIndex((a) => {
      if (!this.column) {
        throw new Error('column is undefined');
      }
      return a.name === this.column.name;
    });

    if (opIndex > -1) {
      // operation found

      for (const task of tasks) {
        const operation = task.operations[opIndex];

        if (operation.rounds.length > 0 && operation.state === TaskStatus.FINISHED) {
          const lastRound: OperationProcessingRound | undefined = operation.lastRound;
          const result = lastRound?.results?.find((a) => !a.isMediaFile());

          if (result?.file) {
            const originalName = result.attributes?.originalFileName ?? result.fullname;

            requestPackage.entries.push({
              path: originalName,
              file: result.file,
            });

            const selectedConverters = AppInfo.converters.filter((a, i) => {
              return this.checkboxes[i];
            });

            const promise = new Promise<void>((resolve, reject) => {
              this.downloadService
                .getConversionFiles(operation, lastRound!, selectedConverters)
                .then((files) => {
                  files = files.filter((a) => a);
                  for (const fileInfo of files) {
                    if (fileInfo?.file) {
                      requestPackage.entries.push({
                        path: fileInfo.fullname,
                        file: fileInfo.file,
                      });
                    }
                  }
                  resolve();
                })
                .catch((error) => {
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
        Promise.all(promises).then(
          () => {
            resolve();
          },
          (error) => {
            reject(error);
          },
        );
      }
    })
      .then(() => {
        if (requestPackage.entries.length > 0) {
          this.archiveName = `${this.column?.name}Results_${dateStr}.zip`;
          this.doZipping(requestPackage.entries);
        } else {
          this.state = 'inactive';
          this.archiveURL = '';
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }

  doLineZipping() {
    // get results url by lines
    if (!(this.selectedTasks === null || this.selectedTasks === undefined)) {
      // prepare package
      const dateStr = DateTime.now().toFormat('yyyy-MM-dd_HH-mm-ss');
      const requestPackage: {
        entries: {
          path: string;
          file: File;
        }[];
      } = {
        entries: [],
      };

      this.archiveName = `transcription-portal_results_${dateStr}`;

      const promises = [];

      for (const index of this.selectedTasks) {
        const entry = this.taskService.state.currentModeState.taskList?.getEntryByIndex(index);

        if (entry instanceof TaskDirectory) {
          promises.push(
            new Promise<void>((resolve, reject) => {
              const dirPromises = [];

              for (const dirEntry of entry.entries) {
                dirPromises.push(this.processTask(dirEntry as Task));
              }

              Promise.all(dirPromises)
                .then((values) => {
                  for (const value of values) {
                    for (const val of value) {
                      val.path = `${entry.foldername}/${val.path}` as never;
                      requestPackage.entries.push(val);
                    }
                  }
                  resolve();
                })
                .catch((error) => {
                  console.error(error);
                });
            }),
          );
        } else {
          // task
          if (entry) {
            promises.push(
              new Promise<void>((resolve, reject) => {
                this.processTask(entry)
                  .then((entries) => {
                    for (const entry2 of entries) {
                      requestPackage.entries.push(entry2);
                    }
                    resolve();
                  })
                  .catch((error) => {
                    console.error(error);
                    reject(error);
                  });
              }),
            );
          }
        }
      }

      Promise.all(promises)
        .then(() => {
          this.doZipping(requestPackage.entries);
        })
        .catch((error) => {
          this.state = 'error';
          console.error(error);
        });
    }
  }

  processTask(task: Task): Promise<
    {
      path: 'string';
      file: File;
    }[]
  > {
    return new Promise<any>((resolve, reject) => {
      if (!(task === null || task === undefined)) {
        // single task
        const entryResult: {
          path: string;
          file: File | undefined;
        }[] = [];

        const promises = [];
        for (let j = 1; j < task.operations.length; j++) {
          const operation = task.operations[j];

          if (operation.name !== task.operations[0].name && operation.state === TaskStatus.FINISHED && operation.rounds.length > 0) {
            const opResult = operation.lastRound;
            const folderName = this.getFolderName(operation);

            if (opResult?.lastResult) {
              const fileName = task.files[0].attributes?.originalFileName.replace(/\.[^.]+$/g, '');
              const originalName = opResult.lastResult.attributes?.originalFileName ?? opResult.lastResult.fullname;

              entryResult.push({
                path: `${fileName}/${folderName}/${originalName}`,
                file: opResult?.lastResult.file,
              });
            }

            const selectedConverters = AppInfo.converters.filter((a, i) => {
              return this.checkboxes[i];
            });

            promises.push(
              new Promise<void>((resolve2, reject2) => {
                this.downloadService
                  .getConversionFiles(operation, operation.lastRound!, selectedConverters)
                  .then((entries) => {
                    const folderName2 = this.getFolderName(operation);
                    entries = entries.filter((a) => a);

                    for (const entry of entries) {
                      const fileName = task.files[0].attributes?.originalFileName.replace(/\.[^.]+$/g, '');
                      const originalName = entry.attributes?.originalFileName ?? entry.fullname;

                      entryResult.push({
                        path: `${fileName}/${folderName2}/${originalName}`,
                        file: entry.file,
                      });
                    }
                    resolve2();
                  })
                  .catch((error) => {
                    reject2(error);
                  });
              }),
            );
          }
        }

        Promise.all(promises)
          .then(() => {
            resolve(entryResult);
          })
          .catch((error) => {
            reject(error);
          });
      } else {
        reject('task is null or undefined');
      }
    });
  }

  doZipping(
    entries: {
      path: string;
      file: File;
    }[],
  ) {
    const zip = new JSZip();

    for (const entry of entries) {
      zip.file(entry.path, entry.file);
    }

    zip.generateAsync({ type: 'base64' }).then((base64) => {
      this.archiveURL = this.sanitizer.bypassSecurityTrustResourceUrl('data:application/zip;base64,' + base64);
      this.state = 'finished';
    });
  }

  removeSelected() {
    if (this.selectedTasks && this.taskService.state.currentModeState.taskList) {
      for (const index of this.selectedTasks) {
        const entry = this.taskService.state.currentModeState.taskList.getEntryByIndex(index);
        if (entry) {
          this.taskService.state.currentModeState.taskList.removeEntry(entry, true);
        } else {
          throw new Error("Can't find entry");
        }
      }
      this.activeModal.close();
    }
  }

  getFolderName(operation: Operation) {
    switch (operation.name) {
      case 'ASR':
        return '1_Speech Recognition';
      case 'OCTRA':
        return '2_Manual Transcription';
      case 'MAUS':
        return '3_Word Alignment';
      case 'Summarization':
        return '3_Summarization';
      case 'Emu WebApp':
        return '4_Phonetic Detail';
      case 'Translation':
        return '4_Translation';
    }

    return '';
  }
}
