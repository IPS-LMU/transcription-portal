import { NgClass, NgStyle } from '@angular/common';
import { Component, ElementRef, inject, OnInit, Renderer2, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { NgbActiveModal, NgbModalOptions, NgbPopover } from '@ng-bootstrap/ng-bootstrap';
import { OctraASRLanguageSelectComponent, OctraProviderSelectComponent, ServiceProvider } from '@octra/ngx-components';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { FileInfo } from '@octra/web-media';
import { OHConfiguration } from '../../obj/oh-config';
import { TimePipe } from '../../shared/time.pipe';
import {
  AppStoreService,
  DefaultUserSettings,
  ModeStoreService,
  OperationFactory,
  StoreAudioFile,
  StoreFile,
  StoreItemTask,
  TaskStatus,
  TPortalModes,
} from '../../store';

@Component({
  selector: 'tportal-queue-modal',
  templateUrl: './queue-modal.component.html',
  styleUrls: ['./queue-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [NgClass, NgStyle, TimePipe, NgbPopover, FormsModule, OctraASRLanguageSelectComponent, OctraProviderSelectComponent],
})
export class QueueModalComponent extends SubscriberComponent implements OnInit {
  protected activeModal = inject(NgbActiveModal);
  private elementRef = inject(ElementRef);
  private renderer = inject(Renderer2);
  private appStoreService = inject(AppStoreService);
  protected modeStoreService = inject(ModeStoreService);

  protected defaultUserSettings: DefaultUserSettings = {};
  protected currentMode?: TPortalModes;
  protected translationProvider?: ServiceProvider;
  protected appSettings?: OHConfiguration;

  @ViewChild('okPopover', { static: true }) okPopover?: NgbPopover;

  get selectedSummarizationNumberOfWords(): number | undefined {
    return this.defaultUserSettings?.selectedSummarizationNumberOfWords || isNaN(Number(this.defaultUserSettings?.selectedSummarizationNumberOfWords))
      ? undefined
      : Number(this.defaultUserSettings?.selectedSummarizationNumberOfWords);
  }

  protected queuedTasks: StoreItemTask[] = [];
  protected operations: {
    factory: OperationFactory;
    enabled: boolean;
  }[] = [];
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
    return this.defaultUserSettings?.selectedASRProvider;
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

    this.appStoreService.updateASRInfo();

    this.compatibleTable = [];
    for (const task of this.queuedTasks) {
      if (task.status === TaskStatus.QUEUED) {
        this.compatibleTable.push({
          id: task.id,
          fileName: task.files[0].name,
          checks: this.checkAudioFileCompatibility(task.files[0] as StoreAudioFile, task.operations[1].serviceProviderName),
        });
      }
    }

    this.subscribe(this.modeStoreService.currentMode$, {
      next: (currentMode) => {
        this.currentMode = currentMode;
        this.afterDefaultSettingsUpdated();
      },
    });

    this.subscribe(this.modeStoreService.defaultUserSettings$, {
      next: (defaultUserSettings) => {
        this.defaultUserSettings = { ...defaultUserSettings };
        this.afterDefaultSettingsUpdated();
      },
    });

    this.subscribe(this.appStoreService.appSettings$, {
      next: (appSettings) => {
        this.appSettings = appSettings;

        this.asrProviders = appSettings?.api?.services.filter((a) => a.type === 'ASR') ?? [];
        this.summarizationProviders = appSettings?.api?.services.filter((a) => a.type === 'Summarization') ?? [];
        this.translationProvider = appSettings?.api.services.find((a) => a.provider === 'LibreTranslate');
      },
    });

    this.subscribe(this.appStoreService.availableLanguages$, {
      next: (availableLanguages) => {
        this.languages.asr = availableLanguages?.asr ?? [];
        this.languages.maus = availableLanguages?.maus ?? [];
        console.log(this.languages);
      },
    });

    this.subscribe(this.modeStoreService.allCurrentTasks$, {
      next: (tasks) => {
        this.queuedTasks = tasks.filter((a) => a.status === TaskStatus.QUEUED);
      },
    });

    this.subscribe(this.modeStoreService.selectedModeDefaultOperations$, {
      next: (operations) => {
        this.operations = operations ?? [];
      },
    });
  }

  afterDefaultSettingsUpdated() {
    if (this.currentMode === 'summarization') {
      this.defaultUserSettings.isDiarizationEnabled = false;
    }
  }

  public get orangeCount(): number {
    if (!(this.queuedTasks.filter === null || this.queuedTasks.filter === undefined)) {
      return this.queuedTasks.filter((a) => {
        const { extension } = FileInfo.extractFileName(a.files[0].name);
        return (
          a.status === TaskStatus.QUEUED &&
          (a.files[0].blob === undefined || extension !== '.wav' || (a.files.length > 1 && a.files[1].blob === undefined))
        );
      }).length;
    }

    return 0;
  }

  onSubmit(form: NgForm) {
    if (form.valid) {
      this.changeProcessingOptionsForEachQueuedTask();
      /* TODO check

      let j = 0;

      for (const task of this.queuedTasks) {
        if (task.status === TaskStatus.QUEUED) {
          if (task.files[0].type.includes('audio') && task.files[0].blob !== undefined && !this.isSomethingInvalid(task.id)) {
            // TODO check task.changeState(TaskStatus.PENDING);
          }

          j++;
        }
      }
       */
      this.activeModal?.close();
    } else {
      for (const key of Object.keys(form.controls)) {
        form.controls[key].markAsTouched();
      }
      this.okPopover?.open();
    }
  }

  onASRProviderChange(provider?: ServiceProvider) {
    if (provider) {
      this.compatibleTable = [];
      for (const task of this.queuedTasks) {
        if (task.status === TaskStatus.QUEUED) {
          this.compatibleTable.push({
            id: task.id,
            fileName: task.files[0].name,
            checks: this.checkAudioFileCompatibility(task.files[0] as StoreAudioFile, provider.provider),
          });
        }
      }
    }
    this.onOptionChange();
  }

  changeProcessingOptionsForEachQueuedTask() {
    this.defaultUserSettings.selectedSummarizationNumberOfWords = this.selectedSummarizationNumberOfWords;
    this.compatibleTable = [];

    this.modeStoreService.applyTaskOptionsOnQueuedTasks({
      asr: {
        provider: this.defaultUserSettings.selectedASRProvider?.provider,
        language: this.defaultUserSettings.selectedASRLanguage,
        diarization: {
          enabled: this.defaultUserSettings.isDiarizationEnabled,
          speakers: this.defaultUserSettings.diarizationSpeakers,
        },
      },
      translation: {
        language: this.defaultUserSettings.selectedTranslationLanguage,
      },
      maus: {
        language: this.defaultUserSettings.selectedMausLanguage,
      },
      summarization: {
        provider: this.defaultUserSettings.selectedSummarizationProvider?.provider,
        numberOfWords: this.defaultUserSettings.selectedSummarizationNumberOfWords,
      },
    });

    /* TODO add
    this.storage.saveDefaultUserSettings({
      asrLanguage: this.defaultUserSettings.selectedASRLanguage,
      mausLanguage: this.defaultUserSettings.selectedMausLanguage,
      asrProvider: this.defaultUserSettings.selectedASRProvider?.provider,
      summarizationProvider: this.defaultUserSettings.selectedSummarizationProvider?.provider,
      translationLanguage: this.defaultUserSettings.selectedTranslationLanguage,
      summarizationWordLimit: this.defaultUserSettings.selectedSummarizationNumberOfWords,
      diarization: this.defaultUserSettings.isDiarizationEnabled,
      diarizationSpeakers: this.defaultUserSettings.diarizationSpeakers,
    });
     */
  }

  onOptionChange() {
    this.modeStoreService.setDefaultUserSettings(this.defaultUserSettings);
  }

  deactivateOperation(name: string, enabled: boolean) {
    this.modeStoreService.setDefaultOperationEnabled(name, enabled);
  }

  public getBadge(task: StoreItemTask): {
    type: string;
    label: string;
  } {
    if (
      (task.files.length > 1 && task.files[1].blob !== undefined) ||
      task.operations[0].rounds.length > 1 ||
      this.getExtension(task.files[0]) !== '.wav'
    ) {
      return {
        type: 'info',
        label: this.getExtension(task.files[0]) !== '.wav' ? this.getExtension(task.files[0]) : this.getExtension(task.files[1]),
      };
    } else {
      return {
        type: 'warning',
        label: this.getExtension(task.files[0]) !== '.wav' ? this.getExtension(task.files[0]) : this.getExtension(task.files[1]),
      };
    }
  }

  onMouseMove() {
    this.mouseInDropdown = true;
  }

  onMouseOut() {
    this.mouseInDropdown = false;
  }

  checkAudioFileCompatibility(audioInfo: StoreAudioFile, asrName?: string) {
    if (!asrName) {
      return [];
    }

    const result: {
      name: string;
      isValid: boolean;
      value: string;
    }[] = [];

    const serviceInfo = this.appSettings?.api?.services.find((a) => a.provider === asrName);
    if (serviceInfo && audioInfo && audioInfo.type.includes('audio')) {
      if (serviceInfo.maxSignalDuration) {
        if (audioInfo.duration / audioInfo.sampleRate > serviceInfo.maxSignalDuration) {
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
        if (audioInfo.size / 1000 / 1000 > serviceInfo.maxSignalSize) {
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
      const compatibleItem = this.compatibleTable.find((a) => a.id === taskID);
      if (compatibleItem && this.isASRSelected()) {
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
    return this.operations.find((a) => a.factory.name === 'ASR')?.enabled ?? false;
  }

  getChecksByID(id: number): CompatibleResult[] {
    const compatibleItem = this.compatibleTable.find((a) => a.id === id);
    if (compatibleItem) {
      return compatibleItem.checks;
    }

    return [];
  }

  getExtension(file: StoreFile) {
    return FileInfo.extractFileName(file.name).extension;
  }
}

interface CompatibleResult {
  name: string;
  isValid: boolean;
  value: string;
}
