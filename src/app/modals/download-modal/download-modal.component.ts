import {Component, Input, OnChanges, OnInit, SimpleChanges, TemplateRef, ViewChild} from '@angular/core';
import {Task, TaskDirectory, TaskState} from '../../obj/tasks';
import {Operation} from '../../obj/operations/operation';
import {AppInfo} from '../../app.info';
import {UploadOperation} from '../../obj/operations/upload-operation';
import {FileInfo} from '../../obj/fileInfo';
import {EmuOperation} from '../../obj/operations/emu-operation';
import {TaskService} from '../../obj/tasks/task.service';
import {HttpClient} from '@angular/common/http';
import {StorageService} from '../../storage.service';
import * as moment from 'moment';
import {OAudiofile} from '../../obj/Annotation';
import {AudioInfo} from '../../obj/audio';
import {Converter, ImportResult} from '../../obj/Converters';
import {BsModalRef, BsModalService} from 'ngx-bootstrap';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';

declare var JSZip;

@Component({
  selector: 'app-download-modal',
  templateUrl: './download-modal.component.html',
  styleUrls: ['./download-modal.component.css']
})
export class DownloadModalComponent implements OnInit, OnChanges {

  @ViewChild('content', {static: true}) content: TemplateRef<any>;
  @Input() type: 'line' | 'column' = 'column';
  @Input() selectedTasks: number[];
  @Input() taskList: Task[];
  @Input() column: Operation;

  downloadModal: BsModalRef;

  public archiveURL: SafeResourceUrl = '';
  public archiveName = '';
  public checkboxes: boolean[] = [];

  public state = 'inactive';

  private subscrManager = new SubscriptionManager();

  public get converters() {
    return AppInfo.converters;
  }

  constructor(private taskService: TaskService, private http: HttpClient, private storage: StorageService,
              private modalService: BsModalService, private sanitizer: DomSanitizer) {

  }

  ngOnInit() {
    this.checkboxes = [];

    for (let i = 0; i < AppInfo.converters.length; i++) {
      this.checkboxes.push(false);
    }
  }

  uncheckAll() {
    for (let i = 0; i < this.checkboxes.length; i++) {
      this.checkboxes[i] = false;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
  }

  public open(type: 'column' | 'line') {
    this.uncheckAll();
    this.type = type;

    this.subscrManager.add(this.modalService.onHidden.subscribe((e) => {
      this.state = 'inactive';
    }));

    this.downloadModal = this.modalService.show(this.content);
  }

  process() {
    this.state = 'processing';
    if (this.type === 'column' && !(this.column instanceof UploadOperation || this.column instanceof EmuOperation)) {
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
        return a.name === this.column.name;
      });

      if (opIndex > -1) {
        // operation found

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const operation = task.operations[opIndex];

          // TODO improve code!
          if (operation.results.length > 0 && operation.state === TaskState.FINISHED) {
            const result: FileInfo = operation.lastResult;
            if (result.online) {
              requestPackage.entries.push({
                path: result.fullname,
                file: result.file
              });

              const promise = new Promise<void>((resolve, reject) => {
                this.getConversionFiles(operation).then((files) => {
                  for (let k = 0; k < files.length; k++) {
                    const fileInfo = files[k];

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
          this.archiveName = `${this.column.name}Results_${dateStr}`;
          this.doZipping(requestPackage.entries);
        } else {
          this.state = 'inactive';
          this.archiveURL = '';
        }
      }).catch((error) => {
        console.error(error);
      });
    } else if (this.type === 'line') {
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

        this.archiveName = `oh-portal_results_${dateStr}`;

        const promises = [];

        for (let i = 0; i < this.selectedTasks.length; i++) {
          const index = this.selectedTasks[i];
          const entry = this.taskService.taskList.getEntryByIndex(index);

          if (entry instanceof TaskDirectory) {

            promises.push(new Promise<void>((resolve, reject) => {
              const dirPromises = [];

              for (let j = 0; j < entry.entries.length; j++) {
                const dirEntry = <Task>entry.entries[j];
                dirPromises.push(this.processTask(dirEntry));
              }

              Promise.all(dirPromises).then((values) => {
                for (let l = 0; l < values.length; l++) {
                  const value = values[l];

                  for (let j = 0; j < value.length; j++) {
                    const val = value[j];
                    val.path = `${entry.foldername}/${val.path}`;
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
            promises.push(
              new Promise<void>((resolve, reject) => {
                this.processTask(entry).then((entries) => {
                  for (let i2 = 0; i2 < entries.length; i2++) {
                    const entry2 = entries[i2];
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

        Promise.all(promises).then(() => {
          this.doZipping(requestPackage.entries);
        }).catch((error) => {
          this.state = 'error';
          console.error(error);
        });
      }
    }
  }

  getConversionFiles(operation: Operation): Promise<FileInfo[]> {
    return new Promise<FileInfo[]>((resolve, reject) => {

      const promises = [];

      for (let i = 0; i < this.checkboxes.length; i++) {
        const checkbox = this.checkboxes[i];

        if (checkbox) {
          const exportConverter = AppInfo.converters[i].obj;

          for (let k = 0; k < operation.results.length; k++) {
            const opResult = operation.results[k];

            if (opResult.fullname.indexOf(exportConverter.extension) < 0) {
              promises.push(this.getResultConversion(exportConverter, operation, opResult));
            }
          }
        }
      }

      Promise.all(promises).then((values) => {
        resolve(values.filter((a) => {
          return !(a === null || a === undefined);
        }));
      }).catch((error) => {
        reject(error);
      });
    });
  }

  getResultConversion(exportConverter: Converter, operation: Operation, opResult: FileInfo): Promise<FileInfo> {
    return new Promise<FileInfo>((resolve, reject) => {
      FileInfo.getFileContent(opResult.file).then((content) => {
        const audiofile = new OAudiofile();
        audiofile.duration = (<AudioInfo>operation.task.files[0]).duration.samples;
        audiofile.name = (<AudioInfo>operation.task.files[0]).name;
        audiofile.samplerate = (<AudioInfo>operation.task.files[0]).samplerate;
        audiofile.size = (<AudioInfo>operation.task.files[0]).size;


        let annotJSON = null;

        // TODO change after next versions
        if (opResult.fullname.indexOf('_annot.json') > -1 || opResult.fullname.indexOf('.json') > -1) {
          annotJSON = JSON.parse(content);
        }

        if ((annotJSON === null || annotJSON === undefined)) {
          // get annotJSON via import
          const importConverter = AppInfo.converters.find((a) => {
            return opResult.fullname.indexOf(a.obj.extension) > -1;
          });

          if (!(importConverter === null || importConverter === undefined)) {
            const result: ImportResult = importConverter.obj.import({
              name: opResult.fullname,
              content: content,
              encoding: 'utf-8',
              type: 'text/plain'
            }, audiofile);
            annotJSON = result.annotjson;
          } else {
            console.error(`found no importConverter for ${opResult.fullname}`);
          }
        }

        const conversion = exportConverter.export(annotJSON, audiofile, 0);

        if (!(conversion === null || conversion === undefined)) {
          const file: File = FileInfo.getFileFromContent(conversion.file.content,
            operation.task.files[0].name + exportConverter.extension, conversion.file.type);

          const fileInfo = new FileInfo(file.name, file.type, file.size, file);
          resolve(fileInfo);
        } else {
          // ignore
          resolve(null);
        }
      }).catch((error) => {
        reject(error);
      });
    });
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
          file: File
        }[] = [];

        const promises = [];
        for (let j = 1; j < task.operations.length; j++) {
          const operation = task.operations[j];

          if (operation.name !== task.operations[0].name && operation.state === TaskState.FINISHED && operation.results.length > 0) {
            const opResult = operation.lastResult;

            entryResult.push({
              path: `${task.files[0].name}/${operation.name}/${opResult.file.name}`,
              file: opResult.file
            });


            promises.push(new Promise<void>((resolve2, reject2) => {
              this.getConversionFiles(operation).then((entries) => {
                for (let k = 0; k < entries.length; k++) {
                  const entry = entries[k];
                  entryResult.push({
                    path: `${task.files[0].name}/${operation.name}/${entry.fullname}`,
                    file: entry.file
                  });
                  resolve2();
                }
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

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      zip.file(entry.path, entry.file);
    }

    zip.generateAsync({type: 'base64'}).then((base64) => {
      this.archiveURL = this.sanitizer.bypassSecurityTrustResourceUrl('data:application/zip;base64,' + base64);
      this.state = 'finished';
    });
  }

  removeSelected() {
    for (let i = 0; i < this.selectedTasks.length; i++) {
      const index = this.selectedTasks[i];
      const entry = this.taskService.taskList.getEntryByIndex(index);
      this.taskService.taskList.removeEntry(entry, true);
    }
  }
}
