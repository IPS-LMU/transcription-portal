import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
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
import {OHConfiguration, OHLanguageObject, OHService} from '../../obj/oh-config';
import {SubscriptionManager} from '../../shared/subscription-manager';
import {BsModalService, ModalDirective} from 'ngx-bootstrap/modal';
import {BsDropdownDirective} from 'ngx-bootstrap/dropdown';
import {PopoverDirective} from 'ngx-bootstrap/popover';
import {AudioInfo} from '@octra/media';
import {FileInfo, isUnset} from '@octra/utilities';

@Component({
  selector: 'app-queue-modal',
  templateUrl: './queue-modal.component.html',
  styleUrls: ['./queue-modal.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None
})
export class QueueModalComponent {
  @ViewChild('queueModal', {static: true}) queueModal: ModalDirective;
  @ViewChild('dropdown', {static: false}) dropdown: BsDropdownDirective;
  @ViewChild('pop', {static: true}) popover: PopoverDirective;

  @Input() tasks: Task[] = [];
  @Input() queue: QueueItem[] = [];
  @Input() operations: Operation[] = [];
  public mouseInDropdown = false;
  public serviceProviders = {};
  private subscrManager = new SubscriptionManager();
  public visible = false;

  public compatibleTable: {
    id: number;
    fileName: string;
    checks: CompatibleResult[];
  }[] = [];

  public get selectedASRInfo(): OHService {
    if (!isUnset(this.serviceProviders) && !isUnset(this.taskService.selectedlanguage)) {
      return this.serviceProviders[this.taskService.selectedlanguage.asr];
    }
    return undefined;
  }

  constructor(private modalService: BsModalService, private sanitizer: DomSanitizer,
              public taskService: TaskService, private storage: StorageService,
              private cd: ChangeDetectorRef) {
    for (const provider of AppSettings.configuration.api.services) {
      this.serviceProviders['' + provider.provider] = provider;
    }
  }

  public get AppConfiguration(): OHConfiguration {
    return AppSettings.configuration;
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

  public open(
    beforeDismiss: () => boolean = () => {
      return true;
    },
    onDismiss: () => void = () => {
    }
  ): void {
    this.subscrManager.add(this.queueModal.onHide.subscribe(() => {
      beforeDismiss();
    }));

    this.subscrManager.add(this.queueModal.onHidden.subscribe(() => {
      onDismiss();
      this.onHidden();
    }));

    this.compatibleTable = [];
    for (const task of this.tasks) {
      if (task.state === TaskState.QUEUED) {
        this.compatibleTable.push({
          id: task.id,
          fileName: task.files[0].fullname,
          checks: this.checkAudioFileCompatibility((task.files[0] as AudioInfo), task.asr)
        });
      }
    }
    this.visible = true;
    this.queueModal.show();
  }

  onHidden() {
    this.visible = false;
    this.subscrManager.destroy();
  }

  onSubmit() {
    this.changeLanguageforAllQueuedTasks();
    let j = 0;

    for (const task of this.tasks) {
      if (task.state === TaskState.QUEUED) {
        if (task.files[0] instanceof AudioInfo && task.files[0].file !== undefined && !this.isSomethingInvalid(task.id)) {
          task.changeState(TaskState.PENDING);
        }

        j++;
      }
    }
    this.queueModal.hide();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  onASRItemClicked(lang: OHLanguageObject) {
    if (lang.state === 'active') {
      this.taskService.selectedlanguage = lang;
      this.changeLanguageforAllQueuedTasks();
    }
  }

  getShortCode(code) {
    return code.substring(code.length - 2);
  }

  changeLanguageforAllQueuedTasks() {
    this.compatibleTable = [];

    const tasks = this.tasks.filter((a) => {
      return a.state === TaskState.QUEUED;
    });

    for (const task of tasks) {
      if (task.state === TaskState.QUEUED) {
        task.language = this.taskService.selectedlanguage.code;
        task.asr = this.taskService.selectedlanguage.asr;
        task.operations[1].providerInformation = AppSettings.getServiceInformation(this.taskService.selectedlanguage.asr);
        this.storage.saveTask(task);

        const audioInfo = (task.files[0] instanceof AudioInfo) ? task.files[0] as AudioInfo : undefined;
        this.compatibleTable.push({
          id: task.id,
          fileName: task.files[0].file.name,
          checks: this.checkAudioFileCompatibility(audioInfo, task.asr)
        });
      }
    }
    this.storage.saveUserSettings('defaultTaskOptions', {
      language: this.taskService.selectedlanguage.code,
      asr: this.taskService.selectedlanguage.asr
    });

    if (!isUnset(this.dropdown)) {
      this.dropdown.hide();
    }

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

        for (const task of tasks) {
          const taskOperation = task.operations[index - 1];
          const currOperation = task.operations[index];

          // check if transcript was added to the task
          const hasTranscript = currOperation.task.files.findIndex((a) => {
            return this.taskService.validTranscript(a.extension);
          }) > -1;

          if (!hasTranscript) {
            if (taskOperation.state === TaskState.PENDING) {
              taskOperation.enabled = previous.enabled;
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

        for (const task of tasks) {
          const taskOperation = task.operations[index + 1];
          const currOperation = task.operations[index];

          if (taskOperation.state === TaskState.PENDING) {
            taskOperation.enabled = next.enabled;
          }
          if (currOperation.state === TaskState.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    } else if (operation instanceof G2pMausOperation) {
      next.enabled = !next.enabled;

      for (const task of tasks) {
        const taskOperation = task.operations[index + 1];
        const currOperation = task.operations[index];

        if (taskOperation.state === TaskState.PENDING) {
          taskOperation.enabled = next.enabled;
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

      for (const task of tasks) {
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
      if (!this.mouseInDropdown && !isUnset(this.dropdown)) {
        this.dropdown.hide();
      }
    }, 500);

    this.mouseInDropdown = false;
  }

  checkAudioFileCompatibility(audioInfo: AudioInfo, asrName: string) {
    const result: {
      name: string,
      isValid: boolean,
      value: string
    }[] = [];

    const serviceInfo = AppSettings.configuration.api.services.find(a => a.provider === asrName);
    if (!isUnset(serviceInfo) && audioInfo instanceof AudioInfo) {
      if (!isUnset(serviceInfo.maxSignalDuration)) {
        if (audioInfo.duration.seconds > serviceInfo.maxSignalDuration) {
          result.push({
            name: 'Signal duration',
            isValid: false,
            value: `max ${serviceInfo.maxSignalDuration} seconds`
          });
        } else {
          result.push({
            name: 'Signal duration',
            isValid: true,
            value: `max ${serviceInfo.maxSignalDuration} seconds`
          });
        }
      }

      if (!isUnset(serviceInfo.maxSignalSize)) {
        if ((audioInfo as FileInfo).size / 1000 / 1000 > serviceInfo.maxSignalSize) {
          result.push({
            name: 'Signal length',
            isValid: false,
            value: `${serviceInfo.maxSignalSize} MB`
          });
        } else {
          result.push({
            name: 'Signal length',
            isValid: true,
            value: `${serviceInfo.maxSignalSize} MB`
          });
        }
      }
    }

    return result;
  }

  isSomethingInvalid(taskID: number) {
    const googleWithAccessCode = this.selectedASRInfo.provider === 'Google' && this.taskService.accessCode.trim() !== '';
    const compatibleItem = this.compatibleTable.find(a => a.id === taskID);
    if (!isUnset(compatibleItem) && this.isASRSelected() && !googleWithAccessCode) {
      return compatibleItem.checks.findIndex(a => !a.isValid) > -1;
    }

    return false;
  }

  onValidationResultMouseEnter(popoverResult: PopoverDirective, id: number) {
    if (this.isSomethingInvalid(id)) {
      popoverResult.show();
    }
  }

  isOneAudiofileInvalid(): boolean {
    return this.compatibleTable.findIndex((a, i) => {
      return this.isSomethingInvalid(a.id);
    }) > -1;
  }

  isASRSelected() {
    return (this.taskService.operations.find(a => a.name === 'ASR').enabled);
  }
}

interface CompatibleResult {
  name: string;
  isValid: boolean;
  value: string;
}
