import {Component, Input, OnInit, ViewChild} from '@angular/core';
import {DomSanitizer} from '@angular/platform-browser';
import {NgbModal, NgbModalRef} from '@ng-bootstrap/ng-bootstrap';
import {Task, TaskState} from '../../obj/tasks';
import {QueueItem} from '../../obj/preprocessor';
import {Operation} from '../../obj/tasks/operation';
import {TaskService} from '../../obj/tasks/task.service';
import {AppInfo} from '../../app.info';
import {ASROperation} from '../../obj/tasks/asr-operation';
import {OCTRAOperation} from '../../obj/tasks/octra-operation';
import {StorageService} from '../../storage.service';
import {isNullOrUndefined} from 'util';

@Component({
  selector: 'app-queue-modal',
  templateUrl: './queue-modal.component.html',
  styleUrls: ['./queue-modal.component.css']
})
export class QueueModalComponent implements OnInit {
  @ViewChild('content') content: NgbModal;
  private modalRef: NgbModalRef;

  @Input() tasks: Task[] = [];
  @Input() queue: QueueItem[] = [];
  @Input() operations: Operation[] = [];

  public get AppInfo() {
    return AppInfo;
  }

  constructor(private modalService: NgbModal, private sanitizer: DomSanitizer, private taskService: TaskService, private storage: StorageService) {
  }

  ngOnInit() {
  }

  public open(beforeDismiss?: () => boolean, onDismiss: () => void = () => {
  }) {
    this.onDismiss = onDismiss;
    this.modalRef = this.modalService.open(this.content, {
      beforeDismiss: beforeDismiss,
      size: 'lg'
    });
  }

  onClose() {

  }

  onDismiss() {
  }

  onSubmit() {
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      if (task.files[0].file !== undefined) {
        task.changeState(TaskState.PENDING);
      }
    }
    this.modalRef.dismiss();
    this.onDismiss();
  }

  public get orangeCount(): number {
    if (!isNullOrUndefined(this.tasks.filter)) {
      console.log(this.tasks);
      return this.tasks.filter((a) => {
        return a.state == TaskState.QUEUED && (a.files[0].file === undefined || a.files[0].extension !== '.wav' || (a.files.length > 1 && a.files[1].file === undefined));
      }).length;
    }

    return 0;
  }

  onASRLangCHanged(lang) {
    if (lang.code !== this.taskService.selectedlanguage.code) {
      this.taskService.selectedlanguage = lang;
      this.changeLanguageforAllQueuedTasks();
    }
  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }

  changeLanguageforAllQueuedTasks() {
    let tasks = this.tasks.filter((a) => {
      return a.state == TaskState.QUEUED;
    });

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.state === TaskState.QUEUED) {
        task.language = this.taskService.selectedlanguage.code;
        this.storage.saveTask(task);
      }
    }
    this.storage.saveUserSettings('defaultTaskOptions', {
      language: this.taskService.selectedlanguage.code
    });
  }

  deactivateOperation(operation: Operation, index: number) {
    let tasks = this.tasks.filter((a) => {
      return a.state == TaskState.QUEUED;
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

          if (task_operation.state === TaskState.PENDING) {
            task_operation.enabled = previous.enabled;
          }

          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
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
    }

    this.updateEnableState();
  }

  public updateEnableState() {
    let tasks = this.tasks.filter((a) => {
      return a.state == TaskState.QUEUED;
    });

    for (let j = 0; j < this.taskService.operations.length; j++) {
      const operation = this.taskService.operations[j];

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const currOperation = task.operations[j];

        if (currOperation.state === TaskState.PENDING) {
          currOperation.enabled = operation.enabled;
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
      }
    }
  }
}
