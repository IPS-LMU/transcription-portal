import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Task, TaskDirectory} from '../../obj/tasks';
import {Operation} from '../../obj/tasks/operation';
import {AppInfo} from '../../app.info';
import {UploadOperation} from '../../obj/tasks/upload-operation';
import {FileInfo} from '../../obj/fileInfo';
import {isArray, isNullOrUndefined} from 'util';
import {EmuOperation} from '../../obj/tasks/emu-operation';
import {TaskService} from '../../obj/tasks/task.service';
import {HttpClient} from '@angular/common/http';
import * as X2JS from 'x2js';
import {StorageService} from '../../storage.service';
import * as moment from 'moment';

@Component({
  selector: 'app-download-modal',
  templateUrl: './download-modal.component.html',
  styleUrls: ['./download-modal.component.css']
})
export class DownloadModalComponent implements OnInit {

  @ViewChild('content') content;
  @Input('type') type: 'line' | 'column' = 'column';
  @Input('selectedTasks') selectedTasks: (Task | TaskDirectory)[];
  @Input('taskList') taskList: Task[];
  @Input('column') column: Operation;

  public archiveURL = '';

  public get AppInfo(): AppInfo {
    return AppInfo;
  }

  constructor(private modalService: NgbModal, private taskService: TaskService, private http: HttpClient, private storage: StorageService) {
  }

  ngOnInit() {
  }

  public open(type: 'column' | 'line') {
    this.type = type;
    this.modalService.open(this.content);
  }

  process() {
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

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];


        const langObj = AppInfo.getLanguageByCode(task.language);
        const url = `${langObj.host}uploadFileMulti`;

        for (let i = 0; i < task.operations.length; i++) {
          const operation = task.operations[i];

          // TODO improve code!
          if (operation.name === this.column.name
            && operation.results.length > 0
          ) {
            const result: FileInfo = operation.lastResult;
            if (result.online) {
              requestPackage.data.files.push({
                name: result.fullname,
                url: result.url
              });
            } else {
              const promise = new Promise<void>((resolve, reject) => {
                UploadOperation.upload([result], url, this.http).subscribe(
                  (obj) => {
                    if (obj) {
                      if (obj.type === 'loadend') {
                        const httpResult = <string> obj.result;
                        const x2js = new X2JS();
                        let json: any = x2js.xml2js(httpResult);
                        json = json.UploadFileMultiResponse;


                        // add messages to protocol
                        if (json.warnings !== '') {
                          console.warn(json.warnings);
                        }

                        if (json.success === 'true') {
                          // TODO set urls to results only
                          if (isArray(json.fileList.entry)) {
                            result.url = json.fileList.entry[0].value;
                          } else {
                            // json attribute entry is an object
                            result.url = json.fileList.entry['value'];
                          }

                          this.storage.saveTask(task);

                          requestPackage.data.files.push({
                            name: result.fullname,
                            url: result.url
                          });

                          resolve();
                        } else {
                          reject(json['message']);
                        }
                      }
                    }
                  },
                  (error) => {
                    reject(error);
                  }
                );
              });

              promises.push(promise);
            }
            break;
          }
        }
      }

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
        this.upDateDownloadURL(requestPackage);
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
          const entry = this.selectedTasks[i];

          if (entry instanceof TaskDirectory) {

            promises.push(new Promise<any>((resolve, reject) => {
              console.log(`process dir!`);
              let dirResult = {
                name: entry.foldername,
                type: 'folder',
                entries: []
              };

              const dirPromises = [];

              for (let j = 0; j < entry.entries.length; j++) {
                console.log(`process ${j}`);
                const dirEntry = <Task> entry.entries[j];
                dirPromises.push(this.processTask(dirEntry));
              }

              Promise.all(dirPromises).then((values) => {
                console.log(`values ${values.length}  items finsihed!`);
                for (let l = 0; l < values.length; l++) {
                  const value = values[l];
                  dirResult.entries.push(value);
                }
                console.log(`dir result`);
                console.log(dirResult);
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
          console.log(`LINE!`);
          console.log(requestPackage);
          this.upDateDownloadURL(requestPackage);
        }).catch((error) => {
          console.error(error);
        });
      }
    }
  }

  processTask(task: Task): Promise<any> {
    return new Promise<any>((resolve, reject) => {
      // single task
      const entryResult = {
        name: task.files[0].name,
        type: 'folder',
        entries: []
      };

      const uploadPromises = [];
      for (let j = 1; j < task.operations.length; j++) {
        const operation = task.operations[j];
        let entryOp = {
          name: operation.name,
          type: 'folder',
          entries: []
        };
        for (let k = 0; k < operation.results.length; k++) {
          const opResult = operation.results[k];

          if (opResult.online) {
            entryOp.entries.push(opResult.url);
          } else {
            // TODO reupload!
          }
        }
        entryResult.entries.push(entryOp);
      }

      Promise.all(uploadPromises).then(() => {
        resolve(entryResult);
      }).catch((error) => {
        reject(error);
      });
    });
  }

  upDateDownloadURL(requestPackage: any) {
    this.http.post('https://www.phonetik.uni-muenchen.de/apps/octra/zAPI/', requestPackage).subscribe(
      (response: any) => {
        console.log(response);
        this.archiveURL = response.result;
      },
      (error) => {
        console.error(error);
      }
    );
  }
}
