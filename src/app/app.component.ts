import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { isNullOrUndefined } from 'util';
import { environment } from '../environments/environment';
import { AppInfo } from './app.info';
import { ANIMATIONS } from './shared/Animations';
import { NotificationService } from './shared/notification.service';
import { SubscriptionManager } from './shared/subscription-manager';
import { TaskService } from './shared/tasks';
import { FileInfo, Operation, Task, TaskState, ToolOperation } from './shared/tasks/obj';

@Component({
  selector   : 'app-root',
  templateUrl: './app.component.html',
  styleUrls  : [ './app.component.css' ],
  providers  : [],
  animations : [ ANIMATIONS ]
})
export class AppComponent implements OnDestroy {
  public showtool = false;
  public sidebarstate = 'hidden';
  public tool_url: SafeResourceUrl;
  public selectedlanguage = AppInfo.languages[ 0 ];

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
        console.log('ERROR! HERE');
        this.blop();
      }
    ));
  }

  public get AppInfo() {
    return AppInfo;
  }

  ngOnDestroy() {
    this.subscrmanager.destroy();
  }

  onAfterDrop(files: FileInfo[]) {
    console.log('dropped');
    if (!isNullOrUndefined(files) && !isNullOrUndefined(this.taskService.operations)) {
      for (let i = 0; i < files.length; i++) {
        const file: FileInfo = files[ i ];

        if (file.type.indexOf('wav') > -1) {
          const task = new Task([ file ], this.taskService.operations);
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
      const file: File = files[ i ];
      const file_infos: FileInfo[] = [];

      if (file.type.indexOf('wav') > -1) {
        file_infos.push(new FileInfo(file.name, file.type, file.size, file));

        const task = new Task(file_infos, this.taskService.operations);

        const newName = FileInfo.escapeFileName(file.name);

        if (newName !== file.name) {
          // no valid name, replace
          FileInfo.renameFile(file, newName, {
            type        : file.type,
            lastModified: file.lastModifiedDate
          }).then((newfile: File) => {
            file_infos[ i ].file = newfile;
          });
        }

        task.language = this.selectedlanguage.code;
        this.newfiles = true;
        this.taskService.addTask(task);
      }
    }
  }

  onOperationClick(operation: Operation) {
    if (operation instanceof ToolOperation) {
      const tool = <ToolOperation> operation;
      this.tool_url = tool.getToolURL();
      this.sidebarstate = 'opened';
      this.showtool = true;
    }
  }

  onASRLangCHanged(lang) {
    if (lang.code !== this.selectedlanguage.code) {
      this.selectedlanguage = lang;
      this.changeLanguageforAllPendingTasks();
    }
  }

  changeLanguageforAllPendingTasks() {
    for (let i = 0; i < this.taskService.tasks.length; i++) {
      const task = this.taskService.tasks[ i ];
      if (task.state === TaskState.PENDING) {
        task.language = this.selectedlanguage.code;
      }
    }
  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }
}
