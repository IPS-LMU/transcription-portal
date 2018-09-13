import {Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Task, TaskDirectory, TaskState} from '../../obj/tasks';
import {Operation} from '../../obj/operations/operation';
import {AppInfo} from '../../app.info';
import {UploadOperation} from '../../obj/operations/upload-operation';
import {FileInfo} from '../../obj/fileInfo';
import {isArray, isNullOrUndefined} from 'util';
import {EmuOperation} from '../../obj/operations/emu-operation';
import {TaskService} from '../../obj/tasks/task.service';
import {HttpClient} from '@angular/common/http';
import * as X2JS from 'x2js';
import {StorageService} from '../../storage.service';
import * as moment from 'moment';
import {OAudiofile} from '../../obj/Annotation';
import {AudioInfo} from '../../obj/audio';
import {Converter, ImportResult} from '../../obj/Converters';

@Component({
  selector: 'app-download-modal',
  templateUrl: './download-modal.component.html',
  styleUrls: ['./download-modal.component.css']
})
export class DownloadModalComponent implements OnInit, OnChanges {

  @ViewChild('content') content;
  @Input('type') type: 'line' | 'column' = 'column';
  @Input('selectedTasks') selectedTasks: number[];
  @Input('taskList') taskList: Task[];
  @Input('column') column: Operation;

  public archiveURL = '';
  public checkboxes: boolean[] = [];

  public state = 'inactive';

  public get AppInfo(): AppInfo {
    return AppInfo;
  }

  constructor(private modalService: NgbModal, private taskService: TaskService, private http: HttpClient, private storage: StorageService) {
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
    this.modalService.open(this.content, {
      beforeDismiss: () => {
        this.state = 'inactive';
        return true;
      }
    });
  }

  process() {
    this.state = 'processing';
    if (this.type === 'column' && !(this.column instanceof UploadOperation || this.column instanceof EmuOperation)) {
      // get url for resulty by column
      // prepare package
      let dateStr = moment().format('YYYY-MM-DD_H-mm-ss');
      let requestPackage = {
        requestType: 'createAchieve',
        data: {
          achieveName: `${this.column.name}Results_${dateStr}`,
          type: 'column',
          files: []
        }
      };
      let tasks = this.taskService.taskList.getAllTasks();

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
              requestPackage.data.files.push({
                name: result.fullname,
                url: result.url
              });

              const promise = new Promise<void>((resolve, reject) => {
                this.getConversionFiles(operation).then((strings) => {
                  for (let k = 0; k < strings.length; k++) {
                    const url = strings[k];

                    const nameObj = FileInfo.extractFileName(url);

                    requestPackage.data.files.push({
                      name: `${nameObj.name}${nameObj.extension}`,
                      url: url
                    });
                  }
                  resolve();
                }).catch((error) => {
                  reject(error);
                });
              });

              promises.push(promise);
            } else {
              // reupload file

              // TODO improve code!
              const promise = new Promise<void>((resolve, reject) => {
                this.uploadFile(result).then((url) => {
                  result.url = url;
                  result.online = true;
                  this.storage.saveTask(task);

                  requestPackage.data.files.push({
                    name: result.fullname,
                    url: result.url
                  });

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
        if (requestPackage.data.files.length > 0) {
          this.upDateDownloadURL(requestPackage);
        } else {
          this.state = 'inactive';
          this.archiveURL = '';
        }
      }).catch((error) => {
        console.error(error);
      });
    } else if (this.type === 'line') {
      // get results url by lines
      if (!isNullOrUndefined(this.selectedTasks)) {
        // prepare package
        let dateStr = moment().format('YYYY-MM-DD_H-mm-ss');
        let requestPackage = {
          requestType: 'createAchieve',
          data: {
            achieveName: `oh-portal_results_${dateStr}`,
            type: 'line',
            structure: []
          }
        };

        const promises = [];

        for (let i = 0; i < this.selectedTasks.length; i++) {
          const index = this.selectedTasks[i];
          const entry = this.taskService.taskList.getEntryByIndex(index);

          if (entry instanceof TaskDirectory) {

            promises.push(new Promise<any>((resolve, reject) => {
              let dirResult = {
                name: entry.foldername,
                type: 'folder',
                entries: []
              };

              const dirPromises = [];

              for (let j = 0; j < entry.entries.length; j++) {
                const dirEntry = <Task> entry.entries[j];
                dirPromises.push(this.processTask(dirEntry));
              }

              Promise.all(dirPromises).then((values) => {
                for (let l = 0; l < values.length; l++) {
                  const value = values[l];
                  dirResult.entries.push(value);
                }
                resolve(dirResult);
              }).catch((error) => {
                console.error(error);
              });
            }));
          } else {
            // task
            promises.push(this.processTask(entry));
          }
        }

        Promise.all(promises).then((values) => {
          for (let l = 0; l < values.length; l++) {
            const value = values[l];
            requestPackage.data.structure.push(value);
          }
          this.upDateDownloadURL(requestPackage);
        }).catch((error) => {
          this.state = 'error';
          console.error(error);
        });
      }
    }
  }

  getConversionFiles(operation: Operation): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {

      const promises = [];

      for (let i = 0; i < this.checkboxes.length; i++) {
        const checkbox = this.checkboxes[i];

        if (checkbox) {
          const exportConverter = AppInfo.converters[i].obj;

          for (let k = 0; k < operation.results.length; k++) {
            const opResult = operation.results[k];

            if (opResult.fullname.indexOf(exportConverter.extension) < 0) {
              promises.push(this.getResultConversionURL(exportConverter, operation, opResult));
            }
          }
        }
      }

      Promise.all(promises).then((values) => {
        resolve(values);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  getResultConversionURL(exportConverter: Converter, operation: Operation, opResult: FileInfo): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      FileInfo.getFileContent(opResult.file).then((content) => {
        const audiofile = new OAudiofile();
        audiofile.duration = (<AudioInfo> operation.task.files[0]).duration.samples;
        audiofile.name = (<AudioInfo> operation.task.files[0]).name;
        audiofile.samplerate = (<AudioInfo> operation.task.files[0]).samplerate;
        audiofile.size = (<AudioInfo> operation.task.files[0]).size;


        let annotJSON = null;

        // TODO change after next versions
        if (opResult.fullname.indexOf('_annot.json') > -1 || opResult.fullname.indexOf('.json') > -1) {
          annotJSON = JSON.parse(content);
        }

        if (isNullOrUndefined(annotJSON)) {
          // get annotJSON via import
          const importConverter = AppInfo.converters.find((a) => {
            return opResult.fullname.indexOf(a.obj.extension) > -1;
          });

          if (!isNullOrUndefined(importConverter)) {
            const result: ImportResult = importConverter.obj.import({
              name: opResult.fullname,
              content: content,
              encoding: 'utf-8',
              type: 'text/plain'
            }, audiofile);
            annotJSON = result.annotjson;
          } else {
            console.log(`found no importConverter for ${opResult.fullname}`);
          }
        }

        const conversion = exportConverter.export(annotJSON, audiofile, 0);

        if (!isNullOrUndefined(conversion)) {
          const file: File = FileInfo.getFileFromContent(conversion.file.content, operation.task.files[0].name + exportConverter.extension, conversion.file.type);

          const fileInfo = new FileInfo(file.name, file.type, file.size, file);

          this.uploadFile(fileInfo).then((url) => {
            resolve(url)
          }).catch((error) => {
            reject(error);
          });

        } else {
          reject('export failed!');
        }
      }).catch((error) => {
        reject(error);
      });
    });
  }

  uploadFile(fileInfo: FileInfo): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      UploadOperation.upload([fileInfo], 'https://clarin.phonetik.uni-muenchen.de/BASWebServices/services/uploadFileMulti', this.http).subscribe(
        (event) => {
          if (event.type === 'loadend') {
            const result = <string> event.result;
            const x2js = new X2JS();
            let json: any = x2js.xml2js(result);
            json = json.UploadFileMultiResponse;

            let url = '';

            if (isArray(json.fileList.entry)) {
              url = json.fileList.entry[0].value;
            } else {
              // json attribute entry is an object
              url = json.fileList.entry['value'];
            }

            resolve(url);
          }
        },
        (err) => {
          reject(err);
        }
      );
    });
  }

  processTask(task: Task): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      if (!isNullOrUndefined(task)) {

        // single task
        const entryResult = {
          name: task.files[0].name,
          type: 'folder',
          entries: []
        };

        const uploadPromises = [];
        for (let j = 1; j < task.operations.length; j++) {
          const operation = task.operations[j];

          if (operation.name !== task.operations[0].name && operation.state === TaskState.FINISHED && operation.results.length > 0) {
            let entryOp = {
              name: operation.name,
              type: 'folder',
              entries: []
            };

            const opResult = operation.lastResult;

            if (opResult.online) {
              entryOp.entries.push(opResult.url);
            } else {
              this.uploadFile(opResult).then((url) => {
                entryOp.entries.push(url);
                opResult.url = url;
                opResult.online = true;
                this.storage.saveTask(task);
              }).catch((error) => {
                console.error(error);
              });
            }

            entryResult.entries.push(entryOp);

            uploadPromises.push(this.getConversionFiles(operation));
          }
        }

        Promise.all(uploadPromises).then((values) => {
          for (let i = 0; i < values.length; i++) {
            const value = values[i];
            entryResult.entries[i].entries = entryResult.entries[i].entries.concat(value);
          }
          resolve(entryResult);
        }).catch((error) => {
          reject(error);
        });
      } else {
        reject('task is null or undefined');
      }
    });
  }

  upDateDownloadURL(requestPackage: any) {
    this.http.post('https://www.phonetik.uni-muenchen.de/apps/octra/zAPI/', requestPackage).subscribe(
      (response: any) => {
        this.archiveURL = response.result;
        this.state = 'finished';
      },
      (error) => {
        console.error(error);
      }
    );
  }

  removeSelected() {
    for (let i = 0; i < this.selectedTasks.length; i++) {
      const index = this.selectedTasks[i];
      const entry = this.taskService.taskList.getEntryByIndex(index);
      this.taskService.taskList.removeEntry(entry, true);
    }
  }
}
