import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { Store } from '@ngrx/store';
import { BugReportService, ConsoleLoggingService, ConsoleLoggingServiceOptions, VersionCheckerService } from '@octra/ngx-components';
import { OctraAPIService } from '@octra/ngx-octra-api';
import { SubscriptionManager } from '@octra/utilities';
import { MaintenanceWarningSnackbar } from 'maintenance-warning-snackbar';
import { catchError, exhaustMap, map, of, tap, withLatestFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { IDBNotificationSettingsItem } from '../../indexedDB';
import { FirstModalComponent } from '../../modals/first-modal/first-modal.component';
import { OHConfiguration } from '../../obj/oh-config';
import { AppSettings } from '../../shared/app.settings';
import { NotificationService } from '../../shared/notification.service';
import { ExternalInformationActions } from '../external-information/external-information.actions';
import { IDBActions } from '../idb/idb.actions';
import { ModeActions } from '../mode/mode.actions';
import { AppActions } from './app.actions';
import { AppState, RootState } from './app.reducer';

@Injectable()
export class AppEffects {
  private actions$ = inject(Actions);
  private store = inject(Store);
  versionChecker = inject(VersionCheckerService);
  private bugService: BugReportService = inject(BugReportService);
  private consoleService = inject(ConsoleLoggingService);
  private http = inject(HttpClient);
  private octraAPI = inject(OctraAPIService);
  protected ngbModalService = inject(NgbModal);
  protected notification = inject(NotificationService);
  private subscrManager = new SubscriptionManager();

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
      ofType(AppActions.loadSettings.success),
      map(({ configuration }) => ModeActions.initModes.do({ settings: configuration })),
    ),
  );

  initConsoleLogger$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppActions.initApplication.do),
      map(() => {
        // overwrite console.log
        if (environment.debugging.enabled && environment.debugging.logging.console) {
          this.consoleService.init(
            new ConsoleLoggingServiceOptions({
              confidentialList: ['(ACCESSCODE=)[^\\s&]+', '(accesscode=)[^\\s&]+'],
            }),
          );
        }

        return AppActions.initConsoleLogger.success();
      }),
    ),
  );

  logActionsToConsole$ = createEffect(
    () =>
      this.actions$.pipe(
        tap((action) => {
          if (environment.debugging.enabled && environment.debugging.logging.actions && action.type.indexOf('Set Console Entries') < 0) {
            console.groupCollapsed(`ACTION ${action.type} ---`);
            console.log(action);
            console.groupEnd();
          }
        }),
      ),
    {
      dispatch: false,
    },
  );

  ApplicationInitSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppActions.initApplication.success),
        tap(() => {
          this.subscrManager.add(
            this.notification.onPermissionChange.subscribe({
              next: (enabled) => {
                this.store.dispatch(
                  AppActions.changeNotificationEnabled.do({
                    enabled,
                  }),
                );
              },
            }),
          );
        }),
      ),
    { dispatch: false },
  );

  appInitSuccess$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(
          AppActions.initVersionChecker.success,
          AppActions.initConsoleLogger.success,
          ModeActions.initModes.success,
          ExternalInformationActions.loadExternInformation.success,
          IDBActions.initIDB.success,
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
        return this.http
          .get<OHConfiguration>('config/config.json', {
            responseType: 'json',
          })
          .pipe(
            map((configuration) => {
              AppSettings.init(configuration);
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
          const notificationItem: IDBNotificationSettingsItem | undefined = action.userSettings.find(
            (a: IDBNotificationSettingsItem) => a.name === 'notification',
          );
          this.notification.permissionGranted = notificationItem?.value.enabled ?? false;

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
