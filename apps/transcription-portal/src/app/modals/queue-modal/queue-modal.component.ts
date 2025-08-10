import { NgClass, NgStyle } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  NgbActiveModal,
  NgbDropdown,
  NgbModalOptions,
  NgbPopover,
} from '@ng-bootstrap/ng-bootstrap';
import {
  OctraASRLanguageSelectComponent,
  OctraProviderSelectComponent,
  ServiceProvider,
} from '@octra/ngx-components';
import { AudioInfo, FileInfo } from '@octra/web-media';
import { OHConfiguration } from '../../obj/oh-config';
import { ASROperation } from '../../obj/operations/asr-operation';
import { G2pMausOperation } from '../../obj/operations/g2p-maus-operation';
import { Operation } from '../../obj/operations/operation';
import { SummarizationOperation } from '../../obj/operations/summarization-operation';
import { TranslationOperation } from '../../obj/operations/translation-operation';
import { QueueItem } from '../../obj/preprocessor';
import { Task, TaskStatus } from '../../obj/tasks';
import { TaskService } from '../../obj/tasks/task.service';
import { AppSettings } from '../../shared/app.settings';
import { SettingsService } from '../../shared/settings.service';
import { TimePipe } from '../../shared/time.pipe';
import { StorageService } from '../../storage.service';

@Component({
  selector: 'tportal-queue-modal',
  templateUrl: './queue-modal.component.html',
  styleUrls: ['./queue-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgClass,
    NgStyle,
    TimePipe,
    NgbPopover,
    FormsModule,
    OctraASRLanguageSelectComponent,
    OctraProviderSelectComponent,
  ],
})
export class QueueModalComponent implements OnDestroy, OnInit {
  protected activeModal = inject(NgbActiveModal);
  taskService = inject(TaskService);
  private storage = inject(StorageService);
  private cd = inject(ChangeDetectorRef);
  private elementRef = inject(ElementRef);
  private settingsService = inject(SettingsService);
  private renderer = inject(Renderer2);

  @ViewChild('dropdown', { static: false }) dropdown?: NgbDropdown;
  @ViewChild('pop', { static: true }) popover?: NgbPopover;

  tasks: Task[] = [];
  queue: QueueItem[] = [];
  operations: Operation[] = [];
  public mouseInDropdown = false;
  public static options: NgbModalOptions = {
    size: 'xl',
    fullscreen: 'lg',
    keyboard: false,
    backdrop: 'static',
  };

  asrProviders: ServiceProvider[] = [];
  summarizationProviders: ServiceProvider[] = [];

  public compatibleTable: {
    id: number;
    fileName: string;
    checks: CompatibleResult[];
  }[] = [];

  public get selectedASRInfo(): ServiceProvider | undefined {
    return this.taskService.state.currentModeState.selectedASRProvider;
  }

  languages: {
    asr: {
      value: string;
      description: string;
      providersOnly?: string[];
    }[];
    maus: {
      value: string;
      description: string;
      providersOnly?: string[];
    }[];
  } = {
    asr: [],
    maus: [],
  };

  ngOnInit(): void {
    this.renderer.addClass(this.elementRef.nativeElement, 'd-flex');
    this.renderer.addClass(this.elementRef.nativeElement, 'flex-column');
    this.renderer.addClass(this.elementRef.nativeElement, 'h-100');

    this.languages.asr = AppSettings.languages?.asr.filter(
      (a) => /(^deu-)|(^ita-)|(^nld-)|(^eng-)/g.exec(a.value) !== null,
    );
    this.languages.maus = AppSettings.languages?.maus.filter(
      (a) => /(^deu-)|(^ita-)|(^nld-)|(^eng-)/g.exec(a.value) !== null,
    );

    this.asrProviders = AppSettings.configuration.api.services.filter(
      (a) => a.type === 'ASR',
    );

    this.summarizationProviders = AppSettings.configuration.api.services.filter(
      (a) => a.type === 'Summarization',
    );

    this.taskService.state.currentModeState.selectedSummarizationProvider =
      this.summarizationProviders[0];
  }

  public get AppConfiguration(): OHConfiguration {
    return AppSettings.configuration;
  }

  public get orangeCount(): number {
    if (!(this.tasks.filter === null || this.tasks.filter === undefined)) {
      return this.tasks.filter((a) => {
        return (
          a.status === TaskStatus.QUEUED &&
          (a.files[0].file === undefined ||
            a.files[0].extension !== '.wav' ||
            (a.files.length > 1 && a.files[1].file === undefined))
        );
      }).length;
    }

    return 0;
  }

  onSubmit() {
    this.changeLanguageforAllQueuedTasks();
    let j = 0;

    for (const task of this.tasks) {
      if (task.status === TaskStatus.QUEUED) {
        if (
          task.files[0] instanceof AudioInfo &&
          task.files[0].file !== undefined &&
          !this.isSomethingInvalid(task.id)
        ) {
          task.changeState(TaskStatus.PENDING);
        }

        j++;
      }
    }
    this.activeModal?.close();
    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  ngOnDestroy() {
    this.settingsService
      .updateASRInfo(AppSettings.configuration)
      .then((result) => {
        console.log(`LOADED and updated!`);
      })
      .catch((error) => {
        console.error(error);
      });

    this.compatibleTable = [];
    for (const task of this.tasks) {
      if (task.status === TaskStatus.QUEUED) {
        this.compatibleTable.push({
          id: task.id,
          fileName: task.files[0].fullname,
          checks: this.checkAudioFileCompatibility(
            task.files[0] as AudioInfo,
            task.operations[1].serviceProvider!.provider,
          ),
        });
      }
    }
  }

  changeLanguageforAllQueuedTasks() {
    if (this.taskService.state.currentModeState.selectedASRLanguage) {
      this.compatibleTable = [];

      const tasks = this.tasks.filter((a) => {
        return a.status === TaskStatus.QUEUED;
      });

      for (const task of tasks) {
        task.setOptions({
          selectedSummarizationProvider:
            this.taskService.state.currentModeState
              .selectedSummarizationProvider,
          selectedASRLanguage:
            this.taskService.state.currentModeState.selectedASRLanguage,
          selectedTargetLanguage:
            this.taskService.state.currentModeState.selectedTranslationLanguage,
          selectedMausLanguage:
            this.taskService.state.currentModeState.selectedMausLanguage,
          selectedASRProvider:
            this.taskService.state.currentModeState.selectedASRProvider,
        });
        this.storage.saveTask(task, this.taskService.state.currentMode);

        const audioInfo: AudioInfo | undefined =
          task.files[0] && task.files[0] instanceof AudioInfo
            ? (task.files[0] as AudioInfo)
            : undefined;
        if (audioInfo) {
          this.compatibleTable.push({
            id: task.id,
            fileName: !audioInfo ? '' : audioInfo.name,
            checks: this.checkAudioFileCompatibility(
              audioInfo,
              task.operations[1].serviceProvider!.provider,
            ),
          });
        }
      }

      this.storage.saveUserSettings('defaultUserSettings', {
        asrLanguage:
          this.taskService.state.currentModeState.selectedASRLanguage,
        mausLanguage:
          this.taskService.state.currentModeState.selectedMausLanguage,
        asrProvider:
          this.taskService.state.currentModeState.selectedASRProvider?.provider,
      });

      if (this.dropdown) {
        this.dropdown.close();
      }

      this.cd.markForCheck();
      this.cd.detectChanges();
    }
  }

  deactivateOperation(operation: Operation, index: number) {
    const tasks = this.tasks.filter((a) => {
      return a.status === TaskStatus.QUEUED;
    });

    operation.enabled = !operation.enabled;
    const previous = this.operations[index - 1];
    const next = this.operations[index + 1];
    if (operation instanceof ASROperation) {
      if (!next.enabled && !operation.enabled) {
        next.enabled = true;

        for (const task of tasks) {
          const taskOperation = task.operations[index + 1];
          const currOperation = task.operations[index];

          if (taskOperation.state === TaskStatus.PENDING) {
            taskOperation.enabled = next.enabled;
          }
          if (currOperation.state === TaskStatus.PENDING) {
            currOperation.enabled = operation.enabled;
          }
        }
      }
    } else if (operation instanceof G2pMausOperation) {
      next.enabled = !next.enabled;

      for (const task of tasks) {
        const taskOperation = task.operations[index + 1];
        const currOperation = task.operations[index];

        if (taskOperation.state === TaskStatus.PENDING) {
          taskOperation.enabled = next.enabled;
        }
        if (currOperation.state === TaskStatus.PENDING) {
          currOperation.enabled = operation.enabled;
        }
      }
    } else if (
      operation instanceof SummarizationOperation ||
      operation instanceof TranslationOperation
    ) {
      for (const task of tasks) {
        const currOperation = task.operations[index];

        if (currOperation.state === TaskStatus.PENDING) {
          currOperation.enabled = operation.enabled;
        }
      }
    } else if (!previous.enabled && !operation.enabled) {
      previous.enabled = true;

      for (const task of tasks) {
        const taskOperation = task.operations[index - 1];
        const currOperation = task.operations[index];

        if (currOperation?.task) {
          // check if transcript was added to the task
          const hasTranscript =
            currOperation.task.files.findIndex((a) => {
              return this.taskService.validTranscript(a.extension);
            }) > -1;

          if (!hasTranscript) {
            if (taskOperation.state === TaskStatus.PENDING) {
              taskOperation.enabled = previous.enabled;
            }

            if (currOperation.state === TaskStatus.PENDING) {
              currOperation.enabled = operation.enabled;
            }
          }
        }
      }
    }

    this.updateEnableState();

    this.cd.markForCheck();
    this.cd.detectChanges();
  }

  public updateEnableState() {
    const tasks = this.tasks.filter((a) => {
      return a.status === TaskStatus.QUEUED;
    });

    for (
      let j = 0;
      j < this.taskService.state.currentModeState.operations.length;
      j++
    ) {
      const operation = this.taskService.state.currentModeState.operations[j];

      for (const task of tasks) {
        const currOperation = task.operations[j];

        if (currOperation?.task) {
          // check if transcript was added to the task
          const hasTranscript =
            currOperation.task.files.findIndex((a) => {
              return this.taskService.validTranscript(a.extension);
            }) > -1;

          if (!hasTranscript) {
            if (currOperation.state === TaskStatus.PENDING) {
              currOperation.enabled = operation.enabled;
            }
          }
        }
      }
    }
  }

  cancelEvent($event: Event) {
    $event.stopPropagation();
    $event.preventDefault();
  }

  public getBadge(task: Task): {
    type: string;
    label: string;
  } {
    if (
      (task.files.length > 1 && task.files[1].file !== undefined) ||
      task.operations[0].results.length > 1 ||
      task.files[0].extension !== '.wav'
    ) {
      return {
        type: 'info',
        label:
          task.files[0].extension !== '.wav'
            ? task.files[0].extension
            : task.files[1].extension,
      };
    } else {
      return {
        type: 'warning',
        label:
          task.files[0].extension !== '.wav'
            ? task.files[0].extension
            : task.files[1].extension,
      };
    }
  }

  onMouseMove() {
    this.mouseInDropdown = true;
  }

  onMouseOut() {
    setTimeout(() => {
      if (!this.mouseInDropdown && this.dropdown) {
        this.dropdown.close();
      }
    }, 500);

    this.mouseInDropdown = false;
  }

  checkAudioFileCompatibility(audioInfo: AudioInfo, asrName: string) {
    const result: {
      name: string;
      isValid: boolean;
      value: string;
    }[] = [];

    const serviceInfo = AppSettings.configuration.api.services.find(
      (a) => a.provider === asrName,
    );
    if (serviceInfo && audioInfo && audioInfo instanceof AudioInfo) {
      if (serviceInfo.maxSignalDuration) {
        if (audioInfo.duration.seconds > serviceInfo.maxSignalDuration) {
          result.push({
            name: 'Signal duration',
            isValid: false,
            value: `max ${serviceInfo.maxSignalDuration} seconds`,
          });
        } else {
          result.push({
            name: 'Signal duration',
            isValid: true,
            value: `max ${serviceInfo.maxSignalDuration} seconds`,
          });
        }
      }

      if (serviceInfo.maxSignalSize) {
        if (
          (audioInfo as FileInfo).size / 1000 / 1000 >
          serviceInfo.maxSignalSize
        ) {
          result.push({
            name: 'Signal length',
            isValid: false,
            value: `${serviceInfo.maxSignalSize} MB`,
          });
        } else {
          result.push({
            name: 'Signal length',
            isValid: true,
            value: `${serviceInfo.maxSignalSize} MB`,
          });
        }
      }
    }

    return result;
  }

  isSomethingInvalid(taskID: number) {
    if (this.selectedASRInfo?.provider) {
      const googleWithAccessCode =
        this.selectedASRInfo.provider === 'Google' &&
        this.taskService.accessCode.trim() !== '';
      const compatibleItem = this.compatibleTable.find((a) => a.id === taskID);
      if (compatibleItem && this.isASRSelected() && !googleWithAccessCode) {
        return compatibleItem.checks.findIndex((a) => !a.isValid) > -1;
      }
    }

    return false;
  }

  onValidationResultMouseEnter(popoverResult: NgbPopover, id: number) {
    if (this.isSomethingInvalid(id)) {
      popoverResult.open();
    }
  }

  isOneAudiofileInvalid(): boolean {
    return (
      this.compatibleTable.findIndex((a, i) => {
        return this.isSomethingInvalid(a.id);
      }) > -1
    );
  }

  isASRSelected() {
    return (
      this.taskService.state.currentModeState.operations.find(
        (a) => a.name === 'ASR',
      )?.enabled ?? false
    );
  }

  getChecksByID(id: number): CompatibleResult[] {
    const compatibleItem = this.compatibleTable.find((a) => a.id === id);
    if (compatibleItem) {
      return compatibleItem.checks;
    }

    return [];
  }

  protected readonly AppSettings = AppSettings;
}

interface CompatibleResult {
  name: string;
  isValid: boolean;
  value: string;
}
