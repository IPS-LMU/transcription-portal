import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, SecurityContext, ViewChild } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { isNullOrUndefined } from 'util';
import { AppInfo } from './app.info';
import { ANIMATIONS } from './shared/Animations';
import { NotificationService } from './shared/notification.service';
import { SubscriptionManager } from './shared/subscription-manager';
import { TaskService } from './shared/tasks';
import { FileInfo, Operation, Task, ToolOperation } from './shared/tasks/obj';

@Component({
  selector   : 'app-root',
  templateUrl: './app.component.html',
  styleUrls  : [ './app.component.css' ],
  providers  : [],
  animations : [ ANIMATIONS ]
})
export class AppComponent implements OnDestroy {
  protected showtool = false;
  public sidebarstate = 'hidden';
  public tool_url: SafeResourceUrl;


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
      const task = new Task(files, this.taskService.operations);

      this.taskService.addTask(task);
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
    const file_infos: FileInfo[] = [];

    for (let i = 0; i < files.length; i++) {
      const file: File = files[ i ];
      file_infos.push(new FileInfo(file.name, file.type, file.size, file));
    }
    if (!isNullOrUndefined(files) && !isNullOrUndefined(this.taskService.operations)) {
      const task = new Task(file_infos, this.taskService.operations);

      this.taskService.addTask(task);
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
}
