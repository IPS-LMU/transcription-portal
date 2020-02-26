import {HttpClient} from '@angular/common/http';
import {ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild} from '@angular/core';
import {DomSanitizer, SafeResourceUrl} from '@angular/platform-browser';
import {environment} from '../environments/environment';
import {AppInfo} from './app.info';
import {ANIMATIONS} from './shared/Animations';
import {NotificationService} from './shared/notification.service';
import {SubscriptionManager} from './shared/subscription-manager';
import {Task} from './obj/tasks';
import {ProceedingsComponent} from './components/proceedings/proceedings.component';
import {TaskService} from './obj/tasks/task.service';
import {StorageService} from './storage.service';
import {Operation} from './obj/operations/operation';
import {FeedbackModalComponent} from './modals/feedback-modal/feedback-modal.component';
import {BugReportService, ConsoleType} from './shared/bug-report.service';
import {SplitModalComponent} from './modals/split-modal/split-modal.component';
import {FirstModalComponent} from './modals/first-modal/first-modal.component';
import {QueueModalComponent} from './modals/queue-modal/queue-modal.component';
import {ProtocolFooterComponent} from './components/protocol-footer/protocol-footer.component';
import {ToolLoaderComponent} from './components/tool-loader/tool-loader.component';
import {AlertService} from './shared/alert.service';
import {StatisticsModalComponent} from './modals/statistics-modal/statistics-modal.component';
import {SettingsService} from './shared/settings.service';
import {OHModalService} from './shared/ohmodal.service';
import {isNullOrUndefined} from './shared/Functions';
import {AppSettings} from './shared/app.settings';

declare var window: any;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  providers: [],
  animations: [ANIMATIONS]
})
export class AppComponent implements OnDestroy {
  @ViewChild('feedbackModal', {static: true}) feedbackModal: FeedbackModalComponent;
  public sidebarstate = 'hidden';
  public tool_url: SafeResourceUrl;
  isCollapsed = false;
  public test = 'inactive';
  public sidebarExpand = 'opened';
  public dragborder = 'inactive';
  public newProceedingsWidth = 30;
  public newToolWidth = 70;
  @ViewChild('fileinput') fileinput: ElementRef;
  @ViewChild('folderinput') folderinput: ElementRef;
  @ViewChild('proceedings') proceedings: ProceedingsComponent;
  @ViewChild('splitModal', {static: true}) splitModal: SplitModalComponent;
  @ViewChild('firstModal', {static: true}) firstModal: FirstModalComponent;
  @ViewChild('queueModal') queueModal: QueueModalComponent;
  @ViewChild('protocolFooter') protocolFooter: ProtocolFooterComponent;
  @ViewChild('toolLoader', {static: true}) toolLoader: ToolLoaderComponent;
  @ViewChild('statisticsModal', {static: true}) statisticsModal: StatisticsModalComponent;
  private firstModalShown = false;
  private blockLeaving = true;
  private subscrmanager = new SubscriptionManager();

  constructor(public taskService: TaskService, private sanitizer: DomSanitizer,
              private httpclient: HttpClient, public notification: NotificationService,
              private storage: StorageService,
              public bugService: BugReportService,
              private alertService: AlertService,
              public settingsService: SettingsService,
              private cd: ChangeDetectorRef,
              private modalService: OHModalService
  ) {

    // overwrite console.log
    if (!AppInfo.debugging) {
      const oldLog = console.log;
      const serv = this.bugService;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.log = function (message) {
          serv.addEntry(ConsoleType.LOG, message);
          oldLog.apply(console, arguments);
        };
      })();

      // overwrite console.err
      const oldError = console.error;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.error = function (error, context) {
          let debug = '';
          let stack = '';

          if (typeof error === 'string') {
            debug = error;

            if (error === 'ERROR' && !isNullOrUndefined(context) && context.hasOwnProperty('stack') && context.hasOwnProperty('message')) {
              debug = context.message;
              stack = context.stack;
            }
          } else {
            if (error instanceof Error) {
              debug = error.message;
              stack = error.stack;
            } else {
              if (typeof error === 'object') {
                // some other type of object
                debug = 'OBJECT';
                stack = JSON.stringify(error);
              } else {
                debug = error;
              }
            }
          }

          if (debug !== '') {
            serv.addEntry(ConsoleType.ERROR, `${debug}${(stack !== '') ? ' ' + stack : ''}`);
          }

          oldError.apply(console, arguments);
        };
      })();

      // overwrite console.warn
      const oldWarn = console.warn;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.warn = function (message) {
          serv.addEntry(ConsoleType.WARN, message);
          oldWarn.apply(console, arguments);
        };
      })();
    }

    this.subscrmanager.add(this.modalService.onFeedBackRequested.subscribe(() => {
      this.feedbackModal.open();
    }));

    this.subscrmanager.add(this.settingsService.settingsload.subscribe(() => {
      // add tracking code
      if (!isNullOrUndefined(AppSettings.configuration.plugins.tracking)
        && !isNullOrUndefined(AppSettings.configuration.plugins.tracking.active)
        && AppSettings.configuration.plugins.tracking.active !== '') {
        this.appendTrackingCode(AppSettings.configuration.plugins.tracking.active);
      }
    }));
  }

  private _showtool = false;

  get showtool(): boolean {
    return this._showtool;
  }

  set showtool(value: boolean) {
    this.sidebarExpand = (value) ? 'closed' : 'opened';
    this._showtool = value;
  }

  public get isdevelopment(): boolean {
    return environment.development;
  }

  public get toolSelectedOperation(): Operation {
    return (!(this.proceedings === null || this.proceedings === undefined)) ? this.proceedings.toolSelectedOperation : undefined;
  }

  public set toolSelectedOperation(value: Operation) {
    this.proceedings.toolSelectedOperation = value;
  }

  public get animationObject(): any {
    const width = 100 - this.newProceedingsWidth;
    return {value: this.sidebarExpand, params: {toolWidth: width, procWidth: this.newProceedingsWidth}}
  }

  public get animationObject2(): any {
    const width = this.newProceedingsWidth;
    return {value: this.sidebarExpand, params: {width: width}}
  }

  public allTasks(): Task[] {
    if (!(this.taskService.taskList === null || this.taskService.taskList === undefined)) {
      return this.taskService.taskList.getAllTasks();
    }

    return [];
  }

  ngOnDestroy(): void {
    this.subscrmanager.destroy();
  }

  private appendTrackingCode(type: string) {
    // check if matomo is activated
    if (type === 'matomo') {
      if (!isNullOrUndefined(AppSettings.configuration.plugins.tracking.matomo)
        && !isNullOrUndefined(AppSettings.configuration.plugins.tracking.matomo.host)
        && !isNullOrUndefined(AppSettings.configuration.plugins.tracking.matomo.siteID)) {
        const matomoSettings = AppSettings.configuration.plugins.tracking.matomo;

        const trackingCode = `
<!-- Matomo -->
<script type="text/javascript">
  var _paq = window._paq || [];
  /* tracker methods like "setCustomDimension" should be called before "trackPageView" */
  _paq.push(['trackPageView']);
  _paq.push(['enableLinkTracking']);
  (function() {
    var u="${matomoSettings.host}";
    _paq.push(['setTrackerUrl', u+'piwik.php']);
    _paq.push(['setSiteId', '${matomoSettings.siteID}']);
    var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0];
    g.type='text/javascript'; g.async=true; g.defer=true; g.src=u+'piwik.js'; s.parentNode.insertBefore(g,s);
  })();
</script>
<!-- End Matomo Code -->`;

        jQuery(trackingCode).insertAfter(jQuery('body').children().last());
      } else {
        console.error(`attributes for matomo tracking in appconfig.json are invalid.`);
      }
    } else {
      console.error(`tracking type ${type} is not supported.`);
    }
  }
}
