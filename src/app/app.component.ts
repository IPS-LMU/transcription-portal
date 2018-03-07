import {HttpClient} from '@angular/common/http';
import {Component, ElementRef, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {isNullOrUndefined} from 'util';
import {environment} from '../environments/environment';
import {AppInfo} from './app.info';
import {ANIMATIONS} from './shared/Animations';
import {NotificationService} from './shared/notification.service';
import {SubscriptionManager} from './shared/subscription-manager';
import {Operation, Task, TaskState, ToolOperation} from './obj/tasks';
import {AudioInfo} from './obj/audio';
import {ProceedingsComponent} from './components/proceedings/proceedings.component';
import {TaskService} from './shared/task.service';
import {DirectoryInfo} from './obj/directoryInfo';
import {TaskDirectory} from './obj/tasks/';
import {StorageService} from './storage.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {FileInfo} from './obj/fileInfo';

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
  private splitModalDismissedProperly = false;


  public get isdevelopment(): boolean {
    return environment.development;
  }

  public test = 'insactive';
  private blockLeaving = true;
  private subscrmanager = new SubscriptionManager();
  @ViewChild('fileinput') fileinput: ElementRef;
  @ViewChild('folderinput') folderinput: ElementRef;
  @ViewChild('proceedings') proceedings: ProceedingsComponent;
  @ViewChild('splitModal') splitModal: NgbModal;

  constructor(public taskService: TaskService, private sanitizer: DomSanitizer,
              private httpclient: HttpClient, public notification: NotificationService,
              private storage: StorageService, private modalService: NgbModal) {

    this.subscrmanager.add(this.taskService.errorscountchange.subscribe(
      () => {
        this.blop();
      }
    ));

    window.onunload = function () {
      alert('You are trying to leave.');
      return false;
    }

    this.taskService.openSplitModal = this.openSplitModal;
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
    console.log(`files dropped`);
    console.log(entries);
    if (!isNullOrUndefined(entries) && !isNullOrUndefined(this.taskService.operations)) {
      // filter and re-structure entries array to supported files and directories
      let filteredEntries = this.taskService.cleanUpInputArray(entries);

      for (let i = 0; i < filteredEntries.length; i++) {
        const entry = filteredEntries[i];

        this.taskService.preprocessor.addToQueue(entry);
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
    if (lang.code !== this.taskService.selectedlanguage.code) {
      this.taskService.selectedlanguage = lang;
      this.changeLanguageforAllPendingTasks();
    }
  }

  changeLanguageforAllPendingTasks() {
    let tasks = this.taskService.taskList.getAllTasks();

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.state === TaskState.PENDING) {
        task.language = this.taskService.selectedlanguage.code;
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
          this.onBackButtonClicked();
        }, 1000);
      } else {

        this.onBackButtonClicked();
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

  public openSplitModal = () => {
    this.modalService.open(this.splitModal, {
      beforeDismiss: () => {
        const old = this.splitModalDismissedProperly;
        this.splitModalDismissedProperly = false;
        return old;
      }
    }).result.then(
      () => {
      }, (reason) => {
        this.taskService.splitPrompt = reason;
        this.onSplitModalDismissed();
      }
    );
  };

  public onSplitModalDismissed = () => {
    this.checkFiles();
  };

  public checkFiles() {
    if (this.taskService.splitPrompt !== 'BOTH') {
      for (let i = 0; i < this.taskService.taskList.entries.length; i++) {
        let entry = this.taskService.taskList.entries[i];

        if (entry instanceof TaskDirectory) {
          if (entry.path.indexOf('_dir') > -1) {


            for (let j = 0; j < entry.entries.length; j++) {
              const dirEntry = <Task> entry.entries[j];

              // TODO improve this code. Determine the channel file using another way
              if (this.taskService.splitPrompt === 'FIRST') {
                if (dirEntry.files[0].fullname.indexOf('_2.') > -1) {
                  entry.entries.splice(j, 1);
                  j--;
                }
              } else if (this.taskService.splitPrompt === 'SECOND') {
                if (dirEntry.files[0].fullname.indexOf('_1.') > -1) {
                  entry.entries.splice(j, 1);
                  j--;
                }
              }
            }
          }

          if (entry.entries.length === 1) {
            // only one item
            console.log(`entry path is ${entry.path}`);
            let path = entry.path.substr(0, entry.path.lastIndexOf('/'));
            path = path.substr(0, path.lastIndexOf('/')) + '/';
            let dirtemp = this.taskService.taskList.findTaskDirByPath(path);

            if (!isNullOrUndefined(dirtemp)) {
              dirtemp.entries.push(entry.entries[0]);
              this.taskService.taskList.removeEntry(entry.entries[0]);
            } else if (path !== '' && path != '/') {
              dirtemp = new TaskDirectory(path);
              dirtemp.addEntries(entry.entries);
              this.taskService.taskList.addEntry(dirtemp);
            } else {
              this.taskService.taskList.entries[i] = entry.entries[0];
            }
          }
        }
      }
    }
  }
}
