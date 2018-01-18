import {HttpClient} from '@angular/common/http';
import {Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {environment} from '../environments/environment';
import {AppInfo} from './app.info';
import {ANIMATIONS} from './shared/Animations';
import {NotificationService} from './shared/notification.service';
import {SubscriptionManager} from './shared/subscription-manager';
import {TaskService} from './shared/tasks';
import {FileInfo, Operation, Task, TaskState, ToolOperation} from './shared/tasks/obj';

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
  private subscrmanager = new SubscriptionManager();
  @ViewChild('fileinput') fileinput: ElementRef;

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

  onAfterDrop(files: FileInfo[]) {
    if (!isNullOrUndefined(files) && !isNullOrUndefined(this.taskService.operations)) {
      for (let i = 0; i < files.length; i++) {
        const file: FileInfo = files[i];

        if (file.type.indexOf('wav') > -1) {
          const task = new Task([file], this.taskService.operations);
          task.language = this.selectedlanguage.code;
          this.newfiles = true;
          this.taskService.addTask(task);
        } else {
          console.log('no wav');
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

  onFileChange($event) {
    const files: FileList = $event.target.files;

    for (let i = 0; i < files.length; i++) {
      const file: File = files[i];
      const file_infos: FileInfo[] = [];

      if (file.type.indexOf('wav') > -1) {
        file_infos.push(new FileInfo(file.name, file.type, file.size, file));
        const index = file_infos.length - 1;
        const newName = FileInfo.escapeFileName(file.name);

        if (newName !== file.name) {
          // no valid name, replace
          FileInfo.renameFile(file, newName, {
            type: file.type,
            lastModified: file.lastModifiedDate
          }).then((newfile: File) => {
            file_infos[index] = new FileInfo(newfile.name, newfile.type, newfile.size, newfile);
          });
        } else {
        }

        const task = new Task(file_infos, this.taskService.operations);

        task.language = this.selectedlanguage.code;
        this.newfiles = true;
        this.taskService.addTask(task);
      }
    }
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
    for (let i = 0; i < this.taskService.tasks.length; i++) {
      const task = this.taskService.tasks[i];
      if (task.state === TaskState.PENDING) {
        task.language = this.selectedlanguage.code;
      }
    }
  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }

  onToolDataReceived($event) {
    console.log(`data received by tool!`);
    console.log($event);
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
    if (!isNullOrUndefined(this.selectedOperation.nextOperation) &&
      this.selectedOperation.nextOperation.state === TaskState.FINISHED) {
      this.selectedOperation.changeState(TaskState.FINISHED);
    } else {
      this.selectedOperation.changeState(TaskState.READY);
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  doSomething($event) {
    $event.returnValue = true;
  }
}
