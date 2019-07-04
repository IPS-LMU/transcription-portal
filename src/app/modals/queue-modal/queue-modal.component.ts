import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  OnInit,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {Task, TaskState} from '../../obj/tasks';
import {QueueItem} from '../../obj/preprocessor';
import {Operation} from '../../obj/operations/operation';
import {TaskService} from '../../obj/tasks/task.service';
import {ASROperation} from '../../obj/operations/asr-operation';
import {OCTRAOperation} from '../../obj/operations/octra-operation';
import {StorageService} from '../../storage.service';
import {G2pMausOperation} from '../../obj/operations/g2p-maus-operation';
import {AppSettings} from '../../shared/app.settings';
import {OHLanguageObject} from '../../obj/oh-config';
import {BsDropdownDirective, BsModalService, ModalDirective, PopoverDirective} from 'ngx-bootstrap';
import {SubscriptionManager} from '../../shared/subscription-manager';

@Component({
  selector: 'app-queue-modal',
  templateUrl: './queue-modal.component.html',
  styleUrls: ['./queue-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class QueueModalComponent implements OnInit {
  @ViewChild('queueModal', {static: true}) queueModal: ModalDirective;
  @ViewChild('dropdown', {static: true}) dropdown: BsDropdownDirective;
  @ViewChild('pop', {static: true}) popover: PopoverDirective;

  @Input() tasks: Task[] = [];
  @Input() queue: QueueItem[] = [];
  @Input() operations: Operation[] = [];

  public get AppSettings() {
    return AppSettings;
  }

  public mouseInDropdown = false;

  public serviceProviders = {};
  private subscrManager = new SubscriptionManager();

  constructor(private modalService: BsModalService, private sanitizer: DomSanitizer,
              public taskService: TaskService, private storage: StorageService,
              private cd: ChangeDetectorRef) {
    for (let i = 0; i < AppSettings.configuration.api.services.length; i++) {
      const provider = AppSettings.configuration.api.services[i];
      this.serviceProviders['' + provider.provider] = provider;
    }
  }

  ngOnInit() {
  }

  public open(beforeDismiss: () => boolean = () => true, onDismiss: () => void = () => {
  }) {
    this.subscrManager.add(this.modalService.onHide.subscribe(() => {
      beforeDismiss();
    }));

    this.subscrManager.add(this.modalService.onHidden.subscribe(() => {
      onDismiss();
      this.onHidden();
    }));

    this.queueModal.show();
  }

  onHidden() {
    this.subscrManager.destroy();
  }

  onSubmit() {
    this.changeLanguageforAllQueuedTasks();
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      if (task.files[0].file !== undefined) {
        task.changeState(TaskState.PENDING);
      }
    }
    this.queueModal.hide();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public get orangeCount(): number {
    if (!(this.tasks.filter === null || this.tasks.filter === undefined)) {
      return this.tasks.filter((a) => {
        return a.state === TaskState.QUEUED && (a.files[0].file === undefined
          || a.files[0].extension !== '.wav' || (a.files.length > 1 && a.files[1].file === undefined));
      }).length;
    }

    return 0;
  }

  onASRLangChanged(lang: OHLanguageObject) {
    this.taskService.selectedlanguage = lang;
    this.changeLanguageforAllQueuedTasks();
  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }

  changeLanguageforAllQueuedTasks() {
    const tasks = this.tasks.filter((a) => {
      return a.state === TaskState.QUEUED;
    });

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.state === TaskState.QUEUED) {
        task.language = this.taskService.selectedlanguage.code;
        task.operations[1].providerInformation = AppSettings.getServiceInformation(this.taskService.selectedlanguage.asr);
        this.storage.saveTask(task);
      }
    }
    this.storage.saveUserSettings('defaultTaskOptions', {
      language: this.taskService.selectedlanguage.code,
      asr: this.taskService.selectedlanguage.asr
    });

    this.dropdown.hide();

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  deactivateOperation(operation: Operation, index: number) {
    const tasks = this.tasks.filter((a) => {
      return a.state === TaskState.QUEUED;
    });

    operation.enabled = !operation.enabled;
    const previous = this.operations[index - 1];
    const next = this.operations[index + 1];
    if (operation instanceof OCTRAOperation) {
      if (!previous.enabled && !operation.enabled) {
        previous.enabled = true;

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const task_operation = task.operations[index - 1];
          const currOperation = task.operations[index];

          // check if transcript was added to the task
          const hasTranscript = currOperation.task.files.findIndex((a) => {
            return this.taskService.validTranscript(a.extension);
          }) > -1;

          if (!hasTranscript) {
            if (task_operation.state === TaskState.PENDING) {
              task_operation.enabled = previous.enabled;
            }

            if (currOperation.state === TaskState.PENDING) {
              currOperation.enabled = operation.enabled;
            }
          }
        }
      }
    } else if (operation instanceof ASROperation) {

      if (!next.enabled && !operation.enabled) {
        next.enabled = true;

        for (let i = 0; i < tasks.length; i++) {
          const task = tasks[i];
          const task_operation = task.operations[index + 1];
          const currOperation = task.operations[index];

          if (task_operation.state === TaskState.PENDING) {
            task_operation.enabled = next.enabled;
          }
          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    } else if (operation instanceof G2pMausOperation) {
      next.enabled = !next.enabled;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const task_operation = task.operations[index + 1];
        const currOperation = task.operations[index];

        if (task_operation.state === TaskState.PENDING) {
          task_operation.enabled = next.enabled;
        }
        if (currOperation.state === TaskState.PENDING) {
          currOperation.enabled = operation.enabled;
        }
      }
    }

    this.updateEnableState();

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public updateEnableState() {
    const tasks = this.tasks.filter((a) => {
      return a.state === TaskState.QUEUED;
    });

    for (let j = 0; j < this.taskService.operations.length; j++) {
      const operation = this.taskService.operations[j];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const currOperation = task.operations[j];

        // check if transcript was added to the task
        const hasTranscript = currOperation.task.files.findIndex((a) => {
          return this.taskService.validTranscript(a.extension);
        }) > -1;

        if (!hasTranscript) {
          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    }
  }

  cancelEvent($event) {
    $event.stopPropagation();
    $event.preventDefault();
  }

  public getBadge(task: Task): {
    type: string,
    label: string
  } {
    if ((task.files.length > 1 && task.files[1].file !== undefined || task.operations[0].results.length > 1)
      || (task.files[0].extension !== '.wav')
    ) {
      return {
        type: 'info',
        label: (task.files[0].extension !== '.wav') ? task.files[0].extension : task.files[1].extension
      };
    } else {
      return {
        type: 'warning',
        label: (task.files[0].extension !== '.wav') ? task.files[0].extension : task.files[1].extension
      };
    }
  }

  onMouseMove() {
    this.mouseInDropdown = true;
  }

  onMouseOut() {
    setTimeout(() => {
      if (!this.mouseInDropdown) {
        this.dropdown.hide();
      }
    }, 500);

    this.mouseInDropdown = false;
  }
}
