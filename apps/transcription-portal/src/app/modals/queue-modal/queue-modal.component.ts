import { AsyncPipe, LowerCasePipe, NgClass, NgStyle } from '@angular/common';
import { AfterViewInit, Component, ElementRef, inject, OnInit, Renderer2, ViewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { NgbActiveModal, NgbModalOptions, NgbPopover, NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
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
  StoreFile,
  StoreItemTask,
  TaskStatus,
  TPortalModes,
} from '../../store';
import { getLastOperationResultFromLatestRound, getLastOperationRound } from '../../store/operation/operation.functions';
import { wait } from '@octra/utilities';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'tportal-queue-modal',
  templateUrl: './queue-modal.component.html',
  styleUrls: ['./queue-modal.component.scss'],
  encapsulation: ViewEncapsulation.None,
  imports: [
    NgClass,
    NgStyle,
    TimePipe,
    NgbPopover,
    FormsModule,
    OctraASRLanguageSelectComponent,
    OctraProviderSelectComponent,
    TranslocoPipe,
    LowerCasePipe,
    NgbTooltip,
    AsyncPipe,
  ],
})
export class QueueModalComponent extends SubscriberComponent implements OnInit, AfterViewInit {
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

  // TODO rewrite all task selects by ID

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

    this.subscribe(this.modeStoreService.defaultModeOperations$, {
      next: (operations) => {
        this.operations = operations ?? [];
      },
    });

    this.modeStoreService.validateQueuedTasks();
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
      this.modeStoreService.markValidQueuedTasksAsPending();
      this.activeModal?.close();
    } else {
      for (const key of Object.keys(form.controls)) {
        form.controls[key].markAsTouched();
      }
      this.okPopover?.open();
    }
  }

  onASRProviderChange(provider?: ServiceProvider) {
    this.onOptionChange();
  }

  changeProcessingOptionsForEachQueuedTask() {
    this.defaultUserSettings.selectedSummarizationNumberOfWords = this.selectedSummarizationNumberOfWords;

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

    this.modeStoreService.setDefaultUserSettings(this.defaultUserSettings);
  }

  onOptionChange() {
    this.changeProcessingOptionsForEachQueuedTask();
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

  isOneAudiofileInvalid() {
    return this.queuedTasks?.find((a) => a.invalid) !== undefined;
  }

  onValidationResultMouseEnter(popoverResult: NgbPopover, task: StoreItemTask) {
    if (task.invalid) {
      popoverResult.open();
    }
  }
  isASRSelected() {
    return this.operations.find((a) => a.factory.name === 'ASR')?.enabled ?? false;
  }

  getExtension(file: StoreFile) {
    return FileInfo.extractFileName(file.name).extension;
  }

  async ngAfterViewInit() {
    await wait(0);
    this.changeProcessingOptionsForEachQueuedTask();
  }

  resetOptions() {
    // TODO implement
  }

  protected readonly getLastOperationRound = getLastOperationRound;
  protected readonly getLastOperationResultFromLatestRound = getLastOperationResultFromLatestRound;
}
