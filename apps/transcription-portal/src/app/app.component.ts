import { Component, inject, OnDestroy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { VersionCheckerService, VersionNotificationComponent } from '@octra/ngx-components';
import { SubscriberComponent } from '@octra/ngx-utilities';
import { hasProperty } from '@octra/utilities';
import { environment } from '../environments/environment';
import { TaskService } from './obj/tasks/task.service';
import { ANIMATIONS } from './shared/Animations';
import { AppSettings } from './shared/app.settings';
import { BugReportService, ConsoleType } from './shared/bug-report.service';
import { NotificationService } from './shared/notification.service';
import { SettingsService } from './shared/settings.service';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgbTooltipConfig } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'tportal-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  providers: [VersionCheckerService],
  animations: [ANIMATIONS],
  imports: [RouterOutlet, VersionNotificationComponent, TranslocoPipe],
})
export class AppComponent extends SubscriberComponent implements OnDestroy {
  taskService = inject(TaskService);
  notification = inject(NotificationService);
  bugService = inject(BugReportService);
  settingsService = inject(SettingsService);
  versionChecker = inject(VersionCheckerService);
  ngbToolTipConfig = inject(NgbTooltipConfig);

  constructor() {
    super();
    this.ngbToolTipConfig.openDelay = 500;

    this.versionChecker.init({
      interval: 5 * 60 * 1000, // check every 5 minutes
    });

    // overwrite console.log
    if (environment.debugging.enabled && environment.debugging.logging.console) {
      console.log('REDIRECT CONSOLE LOGGING ENABLED');
      const oldLog = window.console.log;
      // eslint-disable-next-line @typescript-eslint/no-this-alias
      const serv = this.bugService;

      // tslint:disable-next-line:only-arrow-functions
      window.console.log = (...args) => {
        serv.addEntry(
          ConsoleType.LOG,
          args[0],
        );
        oldLog.apply(console, args);
      };

      // overwrite console.err
      const oldError = window.console.error;
      // tslint:disable-next-line:only-arrow-functions
      window.console.error = (...args) => {
        const error = args[0];
        const context = args[1];

        let debug = '';
        let stack: string | undefined = '';

        if (typeof error === 'string') {
          debug = error;

          if (
            error === 'ERROR' &&
            context !== undefined &&
            context.stack &&
            context.message
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

      // overwrite console.warn
      const oldWarn = window.console.warn;

      // tslint:disable-next-line:only-arrow-functions
      console.warn = (...args) => {
        serv.addEntry(
          ConsoleType.WARN,
          args[0],
        );
        oldWarn.apply(console, args);
      };
    }

    this.subscribe(this.settingsService.settingsload, {
      complete: () => {
        // add tracking code
        if (
          AppSettings.configuration.plugins.tracking &&
          AppSettings.configuration.plugins.tracking.active &&
          AppSettings.configuration.plugins.tracking.active !== ''
        ) {
          this.appendTrackingCode(AppSettings.configuration.plugins.tracking.active);
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

  override ngOnDestroy() {
    super.ngOnDestroy();
    this.taskService.destroy();
  }
}
