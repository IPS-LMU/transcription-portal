import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { VersionCheckerService } from '@octra/ngx-components';
import { OctraAPIService } from '@octra/ngx-octra-api';
import { hasProperty } from '@octra/utilities';
import { MaintenanceWarningSnackbar } from 'maintenance-warning-snackbar';
import { catchError, exhaustMap, map, of, tap, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FirstModalComponent } from '../../modals/first-modal/first-modal.component';
import { OHConfiguration } from '../../obj/oh-config';
import { AppSettings } from '../../shared/app.settings';
import { BugReportService, ConsoleType } from '../../shared/bug-report.service';
import { ExternalInformationActions } from '../external-information';
import { IDBActions } from '../idb';
import { ModeActions } from '../mode';
import { AppActions } from './app.actions';
import { AppState, RootState } from './app.reducer';

@Injectable()
export class AppEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  versionChecker = inject(VersionCheckerService);
  bugService = inject(BugReportService);
  private http = inject(HttpClient);
  private octraAPI = inject(OctraAPIService);
  protected ngbModalService = inject(NgbModal);

  initVersionChecker$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.initApplication.do),
      map(() => {
        this.versionChecker.init({
          interval: 5 * 60 * 1000, // check every 5 minutes
        });
        return AppActions.initVersionChecker.success();
      }),
    ),
  );

  initModes$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.initApplication.do),
      map(() => ModeActions.initModes.do()),
    ),
  );

  initConsoleLogger$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.initApplication.do),
      map(() => {
        console.log('INIT CONSOLE LOGGING');
        // overwrite console.log
        if (environment.debugging.enabled && environment.debugging.logging.console) {
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

                if (error === 'ERROR' && context && hasProperty(context, 'stack') && hasProperty(context, 'message')) {
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
                serv.addEntry(ConsoleType.ERROR, `${debug}${stack !== '' ? ' ' + stack : ''}`);
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

        return AppActions.initConsoleLogger.success();
      }),
    ),
  );

  appInitSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          AppActions.initVersionChecker.success,
          AppActions.initConsoleLogger.success,
          ModeActions.initModes.success,
          ExternalInformationActions.loadExternInformation.success,
        ),
        withLatestFrom(this.store),
        tap(([, state]: [any, RootState]) => {
          if (
            ![
              state.app.consoleLoggingInitialized,
              state.app.modesInitialized,
              state.app.versionCheckerStarted,
              state.externalInformation.asrInfoRetrieved,
              state.externalInformation.asrQuotaRetrieved,
              state.externalInformation.asrLanguagesInitialized,
              state.externalInformation.mausLanguagesInitialized,
              state.app.idbInitialized,
            ].includes(false)
          ) {
            this.store.dispatch(AppActions.initApplication.success());
          }
        }),
      ),
    { dispatch: false },
  );

  loadSettings$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.initApplication.do),
      withLatestFrom(this.store),
      exhaustMap(([a, state]: [any, AppState]) => {
        console.log('LOAD SETTINGS');
        return this.http
          .get<OHConfiguration>('config/config.json', {
            responseType: 'json',
          })
          .pipe(
            map((configuration) => {
              return AppActions.loadSettings.success({
                configuration,
              });
            }),
            catchError((error: HttpErrorResponse) => {
              return of(
                AppActions.loadSettings.fail({
                  error: error.error?.message ?? error.message,
                }),
              );
            }),
          );
      }),
    ),
  );

  settingsLoaded$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.loadSettings.success),
        withLatestFrom(this.store),
        tap(([action, state]: [any, RootState]) => {
          const settings = state.app.settings;
          if (!settings) {
            return;
          }
          AppSettings.init(settings);

          // add tracking code
          if (settings.plugins.tracking && settings.plugins.tracking.active && settings?.plugins.tracking.active !== '') {
            this.appendTrackingCode(settings.plugins.tracking.active);
          }

          if (settings.plugins.maintenance?.active && settings.plugins.maintenance?.outagesURL && settings.plugins.maintenance?.outageTextURL) {
            const snackbar = new MaintenanceWarningSnackbar({
              jsonURL: settings?.plugins.maintenance.outagesURL,
              txtURL: settings?.plugins.maintenance.outageTextURL,
              nrOfDaysBe4MaintToDisplayMessage: 3,
              simulate: false,
              verbose: false,
            });
            snackbar.initialize().catch((err) => {
              console.error(err);
            });
          }

          this.store.dispatch(AppActions.initOctraAPI.do());
        }),
      ),
    { dispatch: false },
  );

  initOctraAPI$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.initOctraAPI.do),
      withLatestFrom(this.store),
      exhaustMap(([action, state]: [any, RootState]) => {
        // this._feedbackEnabled = (properties.send_feedback && properties.email_notification) ?? false;
        if (!state.app.settings) {
          return of(
            AppActions.initOctraAPI.fail({
              error: 'Missing settings',
            }),
          );
        }

        return this.octraAPI.init(state.app.settings.api.octraBackend.url, state.app.settings.api.octraBackend.key, undefined, false).pipe(
          map((serverProperties) => {
            return AppActions.initOctraAPI.success({ serverProperties });
          }),
          catchError((error: HttpErrorResponse) => {
            return of(AppActions.initOctraAPI.fail({ error: error.error?.message ?? error.message }));
          }),
        );
      }),
    ),
  );

  checkFirstModal$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(IDBActions.initIDB.loaded),
        withLatestFrom(this.store),
        tap(([action, state]: [any, RootState]) => {
          if (!state.app.firstModalShown) {
            this.loadFirstModal();
          }
        }),
      ),
    { dispatch: false },
  );

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

  private loadFirstModal() {
    setTimeout(() => {
      const ref = this.ngbModalService.open(FirstModalComponent, FirstModalComponent.options);
      ref.result.then(() => {
        this.store.dispatch(
          IDBActions.saveInternValues.do({
            items: [
              {
                name: 'firstModalShown',
                value: true,
              },
            ],
          }),
        );
      });
    }, 1000);
  }
}
