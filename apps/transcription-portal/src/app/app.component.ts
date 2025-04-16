import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { hasProperty } from '@octra/utilities';
import { AppInfo } from './app.info';
import { ProceedingsComponent } from './components/proceedings/proceedings.component';
import { ProtocolFooterComponent } from './components/protocol-footer/protocol-footer.component';
import { ToolLoaderComponent } from './components/tool-loader/tool-loader.component';
import { FirstModalComponent } from './modals/first-modal/first-modal.component';
import { SplitModalComponent } from './modals/split-modal/split-modal.component';
import { TaskService } from './obj/tasks/task.service';
import { ANIMATIONS } from './shared/Animations';
import { AppSettings } from './shared/app.settings';
import { BugReportService, ConsoleType } from './shared/bug-report.service';
import { NotificationService } from './shared/notification.service';
import { SettingsService } from './shared/settings.service';

@Component({
  selector: 'tportal-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [],
  animations: [ANIMATIONS],
  imports: [RouterOutlet],
})
export class AppComponent extends SubscriberComponent implements OnDestroy {
  public test = 'inactive';
  @ViewChild('fileinput') fileinput!: ElementRef;
  @ViewChild('folderinput') folderinput!: ElementRef;
  @ViewChild('proceedings') proceedings?: ProceedingsComponent;
  @ViewChild('splitModal', { static: true }) splitModal!: SplitModalComponent;
  @ViewChild('firstModal', { static: true }) firstModal!: FirstModalComponent;
  @ViewChild('protocolFooter') protocolFooter!: ProtocolFooterComponent;
  @ViewChild('toolLoader', { static: true }) toolLoader!: ToolLoaderComponent;

  constructor(
    public taskService: TaskService,
    public notification: NotificationService,
    public bugService: BugReportService,
    public settingsService: SettingsService,
    private activeRoute: ActivatedRoute,
  ) {
    super();

    this.subscribe(this.activeRoute.queryParams, {
      next: (param: any) => {
        console.log('FOUND PARAMS APP');
        console.log(param['test']);
      },
    });

    // overwrite console.log
    if (!AppInfo.debugging) {
      const oldLog = console.log;
      const serv = this.bugService;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.log = function (message, ...args) {
          serv.addEntry(ConsoleType.LOG, message);
          oldLog.apply(console, args);
        };
      })();

      // overwrite console.err
      const oldError = console.error;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.error = function (error, context, ...args) {
          let debug = '';
          let stack: string | undefined = '';

          if (typeof error === 'string') {
            debug = error;

            if (
              error === 'ERROR' &&
              context &&
              hasProperty(context, 'stack') &&
              hasProperty(context, 'message')
            ) {
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
            serv.addEntry(
              ConsoleType.ERROR,
              `${debug}${stack !== '' ? ' ' + stack : ''}`,
            );
          }

          oldError.apply(console, args);
        };
      })();

      // overwrite console.warn
      const oldWarn = console.warn;
      (() => {
        // tslint:disable-next-line:only-arrow-functions
        console.warn = function (message, ...args) {
          serv.addEntry(ConsoleType.WARN, message);
          oldWarn.apply(console, args);
        };
      })();
    }

    this.subscribe(this.settingsService.settingsload, {
      complete: () => {
        // add tracking code
        if (
          AppSettings.configuration.plugins.tracking &&
          AppSettings.configuration.plugins.tracking.active &&
          AppSettings.configuration.plugins.tracking.active !== ''
        ) {
          this.appendTrackingCode(
            AppSettings.configuration.plugins.tracking.active,
          );
        }
      },
    });
  }

  private appendTrackingCode(type: string) {
    // check if matomo is activated
    if (type === 'matomo') {
      if (
        AppSettings.configuration?.plugins?.tracking?.matomo &&
        AppSettings.configuration?.plugins?.tracking?.matomo.host &&
        AppSettings.configuration?.plugins?.tracking?.matomo.siteID
      ) {
        const matomoSettings =
          AppSettings.configuration.plugins.tracking.matomo;

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
        console.error(
          `attributes for matomo tracking in appconfig.json are invalid.`,
        );
      }
    } else {
      console.error(`tracking type ${type} is not supported.`);
    }
  }
}
