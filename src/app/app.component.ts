import {HttpClient} from '@angular/common/http';
import {Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {environment} from '../environments/environment';
import {AppInfo} from './app.info';
import {ANIMATIONS} from './shared/Animations';
import {NotificationService} from './shared/notification.service';
import {SubscriptionManager} from './shared/subscription-manager';
import {FileInfo, Operation, Task, TaskState, ToolOperation} from './obj/tasks/index';
import {AudioInfo, AudioManager} from './obj/audio';
import {WavFormat} from './obj/audio/AudioFormats';
import {ProceedingsComponent} from './components/proceedings/proceedings.component';
import {TaskService} from './shared/task.service';
import {DirectoryInfo} from './obj/directoryInfo';
import {TaskDirectory} from './obj/taskDirectory';

declare var window: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [],
  animations: [ANIMATIONS]
})
export class AppComponent implements OnDestroy {
  public showtool = false;
  public sidebarstate = 'hidden';
  public tool_url: SafeResourceUrl;
  public selectedOperation: Operation = null;
  public selectedlanguage = AppInfo.languages[0];

  public newfiles = false;

  public get isdevelopment(): boolean {
    return environment.development;
  }

  public test = 'insactive';
  private blockLeaving = true;
  private subscrmanager = new SubscriptionManager();
  @ViewChild('fileinput') fileinput: ElementRef;
  @ViewChild('folderinput') folderinput: ElementRef;
  @ViewChild('proceedings') proceedings: ProceedingsComponent;

  constructor(public taskService: TaskService, private sanitizer: DomSanitizer,
              private httpclient: HttpClient, public notification: NotificationService) {

    this.subscrmanager.add(this.taskService.errorscountchange.subscribe(
      () => {
        this.blop();
      }
    ));

    window.onunload = function () {
      alert('You are trying to leave.');
      return false;
    }
  }

  public get AppInfo() {
    return AppInfo;
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  onAfterDrop(entries: (FileInfo | DirectoryInfo)[]) {
    this.readNewFiles(entries)
  }

  private readNewFiles(entries: (FileInfo | DirectoryInfo)[]) {
    if (!isNullOrUndefined(entries) && !isNullOrUndefined(this.taskService.operations)) {
      // filter and re-structure entries array to supported files and directories
      let filteredEntries = this.taskService.cleanUpInputArray(entries);

      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];

        if (entry instanceof FileInfo) {
          let file = <FileInfo> entry;

          const newName = FileInfo.escapeFileName(file.fullname);
          let newFile: File = null;

          const task = new Task([file], this.taskService.operations);

          new Promise<void>((resolve, reject) => {
              if (newName !== file.name) {
                // no valid name, replace
                FileInfo.renameFile(file.file, newName, {
                  type: file.type,
                  lastModified: file.file.lastModifiedDate
                }).then((newfile: File) => {
                  task.files[0] = new FileInfo(newfile.name, newfile.type, newfile.size, newfile);
                  newFile = newfile;
                  resolve()
                });
              } else {
                resolve()
              }
            }
          ).then(() => {
            task.language = this.selectedlanguage.code;
            this.newfiles = true;

            setTimeout(() => {
              let reader = new FileReader();
              reader.onload = (event: any) => {
                const format = new WavFormat(event.target.result);
                if (format.isValid(event.target.result) && format.channels > 1) {
                  console.log(`OKOKOKOK`);

                  const directory = new DirectoryInfo(file.name + '_dir/');

                  const files: File[] = format.splitChannelsToFiles(file.name, 'x-audio/wav', event.target.result);
                  const fileInfos: FileInfo[] = [];

                  for (let i = 0; i < files.length; i++) {
                    const file = files[i];
                    const fileInfo = FileInfo.fromFileObject(file);

                    fileInfos.push(fileInfo);
                  }
                  directory.addEntries(fileInfos);
                  this.readNewFiles([directory]);
                  this.taskService.taskList.removeEntry(task);
                  console.log(directory);
                } else {
                  AudioManager.decodeAudio(file.fullname, event.target.result, [new WavFormat(event.target.result)], false).then((manager: AudioManager) => {
                    task.files[0] = manager.ressource.info;
                    task.files[0].fullname = newName;

                    if (isNullOrUndefined(newFile)) {
                      task.files[0].file = file.file;
                    } else {
                      task.files[0].file = newFile;
                    }
                  }).catch((error) => {
                    this.taskService.taskList.removeEntry(task);
                    console.error(error);
                  });
                }
              };
              reader.readAsArrayBuffer(file.file);
            }, 1000);

            // set state
            for (let i = 0; i < this.taskService.operations.length; i++) {
              const operation = this.taskService.operations[i];

              task.operations[i].enabled = operation.enabled;
            }
            this.taskService.addEntry(task);
          });
        } else if (entry instanceof DirectoryInfo) {
          let dir = <DirectoryInfo> entry;

          let dirTask = new TaskDirectory(dir.path, dir.size);

          for (let i = 0; i < dir.entries.length; i++) {
            const dirEntry = dir.entries[i];

            if (dirEntry instanceof FileInfo) {
              const file = <FileInfo> dirEntry;

              const newName = FileInfo.escapeFileName(file.fullname);
              let newFile: File = null;

              const task = new Task([file], this.taskService.operations, dirTask);

              new Promise<void>((resolve, reject) => {
                  if (newName !== file.name) {
                    // no valid name, replace
                    FileInfo.renameFile(file.file, newName, {
                      type: file.type,
                      lastModified: file.file.lastModifiedDate
                    }).then((newfile: File) => {
                      task.files[0] = new FileInfo(newfile.name, newfile.type, newfile.size, newfile);
                      newFile = newfile;
                      resolve()
                    });
                  } else {
                    resolve()
                  }
                }
              ).then(() => {
                task.language = this.selectedlanguage.code;
                this.newfiles = true;

                setTimeout(() => {
                  let reader = new FileReader();
                  reader.onload = (event: any) => {
                    const format = new WavFormat(event.target.result);
                    if (format.isValid(event.target.result) && format.channels > 1) {
                      console.log(`OKOKOKOK`);
                      const directory = new DirectoryInfo(file.name + '_dir/');

                      const files: File[] = format.splitChannelsToFiles(file.name, 'x-audio/wav', event.target.result);
                      const fileInfos: FileInfo[] = [];

                      for (let i = 0; i < files.length; i++) {
                        const file = files[i];
                        const fileInfo = FileInfo.fromFileObject(file);

                        fileInfos.push(fileInfo);
                      }
                      directory.addEntries(fileInfos);
                      this.readNewFiles([directory]);
                      this.taskService.taskList.removeEntry(task);
                      console.log(directory);
                    } else {
                      const format = new WavFormat(event.target.result);
                      AudioManager.decodeAudio(file.fullname, event.target.result, [format], false).then((manager: AudioManager) => {
                        task.files[0] = manager.ressource.info;
                        task.files[0].fullname = newName;

                        if (isNullOrUndefined(newFile)) {
                          task.files[0].file = file.file;
                        } else {
                          task.files[0].file = newFile;
                        }
                      }).catch((error) => {
                        this.taskService.taskList.removeEntry(task);
                        console.error(error);
                      });
                    }
                  };
                  reader.readAsArrayBuffer(file.file);
                }, 1000);

                // set state
                for (let i = 0; i < this.taskService.operations.length; i++) {
                  const operation = this.taskService.operations[i];

                  task.operations[i].enabled = operation.enabled;
                }
                dirTask.addEntries([task]);
              });
            }
          }
          this.taskService.addEntry(dirTask);
        }
      }
    }
  }

  onUploadButtonClick() {
    // start first operation of this task
    this.taskService.start();
  }

  onMissedDrop(event) {
    event.stopPropagation();
    event.preventDefault();
  }

  blop() {
    this.test = 'blopped';
    setTimeout(() => {
      this.test = 'inactive';
    }, 500);
  }

  onProtoclLabelClick(tag: HTMLSpanElement) {
    if (tag.getAttribute('data-state') === 'opened') {
      tag.setAttribute('data-state', 'closed');
    } else {
      tag.setAttribute('data-state', 'opened');
    }
  }

  onFilesAddButtonClicked() {
    this.fileinput.nativeElement.click();
  }

  onFoldersAddButtonClicked() {
    this.folderinput.nativeElement.click();
  }

  onFileChange($event) {
    const files: FileList = $event.target.files;
    const test = $event.target.items;
    const file_infos: FileInfo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file: File = files[i];
      file_infos.push(new FileInfo(file.name, file.type, file.size, file));
    }

    this.readNewFiles(file_infos);
  }

  onOperationClick(operation: Operation) {
    if (operation instanceof ToolOperation) {
      const tool = <ToolOperation> operation;
      const index = tool.task.operations.findIndex((op) => {
        if (op.id === tool.id) {
          return true;
        }
      });

      if (index < tool.task.operations.length - 1) {
        // start processing
        tool.changeState(TaskState.PROCESSING);
      }

      this.tool_url = tool.getToolURL();

      if (!isNullOrUndefined(this.selectedOperation) && operation.id !== this.selectedOperation.id) {
        // some operation already initialized
        this.leaveToolOption();
      }

      this.selectedOperation = operation;
      this.sidebarstate = 'opened';

      this.showtool = true;
    }
  }

  onOperationHover(operation: Operation) {
  }

  onASRLangCHanged(lang) {
    if (lang.code !== this.selectedlanguage.code) {
      this.selectedlanguage = lang;
      this.changeLanguageforAllPendingTasks();
    }
  }

  changeLanguageforAllPendingTasks() {
    let tasks = this.taskService.taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.state === TaskState.PENDING) {
        task.language = this.selectedlanguage.code;
      }
    }
  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }

  onToolDataReceived($event) {
    if ($event.data.hasOwnProperty('data') && $event.data.data.hasOwnProperty('transcript_url')) {
      const result: string = $event.data.data.transcript_url;

      if (this.selectedOperation.results.length < 1) {
        this.selectedOperation.results.push(FileInfo.fromURL(result));
      } else {
        this.selectedOperation.results[0] = FileInfo.fromURL(result);
      }

      const index = this.selectedOperation.task.operations.findIndex((op) => {
        if (op.id === this.selectedOperation.id) {
          return true;
        }
      });

      let startedBefore = false;
      // reset next operations
      if (index > -1) {
        for (let i = index + 1; i < this.selectedOperation.task.operations.length; i++) {
          const operation = this.selectedOperation.task.operations[i];
          if (operation.state !== TaskState.PENDING) {
            startedBefore = true;
          }
          operation.changeState(TaskState.PENDING);
        }
      } else {
        console.error(`index is ${index}`);
      }

      this.selectedOperation.changeState(TaskState.FINISHED);

      if (startedBefore) {
        setTimeout(() => {
          this.selectedOperation.task.restart(this.httpclient);
        }, 1000);
      }
    }
  }

  onBackButtonClicked() {
    this.showtool = false;
    this.sidebarstate = 'hidden';
    this.leaveToolOption();
  }

  leaveToolOption() {
    if (!isNullOrUndefined(this.selectedOperation.nextOperation)) {
      if (this.selectedOperation.nextOperation.state === TaskState.FINISHED) {
        this.selectedOperation.changeState(TaskState.FINISHED);
      }
    } else {
      this.selectedOperation.changeState(TaskState.READY);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  doSomething($event) {
    $event.returnValue = this.blockLeaving;
  }

  public getTime(): number {
    let elem: AudioInfo = <AudioInfo> this.selectedOperation.task.files[0];

    if (!isNullOrUndefined(elem.duration)) {
      return elem.duration.unix;
    }

    return 0;
  }
}
