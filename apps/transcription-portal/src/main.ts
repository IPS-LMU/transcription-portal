/// <reference types="@angular/localize" />

import { enableProdMode, importProvidersFrom, isDevMode } from '@angular/core';

import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideServiceWorker } from '@angular/service-worker';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { VersionCheckerService } from '@octra/ngx-components';
import { NgCircleProgressModule } from 'ng-circle-progress';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { AppRoutingModule } from './app/app-routing.module';
import { AppComponent } from './app/app.component';
import { TaskService } from './app/obj/tasks/task.service';
import { AlertService } from './app/shared/alert.service';
import { BugReportService } from './app/shared/bug-report.service';
import { CompatibilityService } from './app/shared/compatibility.service';
import { DownloadService } from './app/shared/download.service';
import { NotificationService } from './app/shared/notification.service';
import { OHModalService } from './app/shared/ohmodal.service';
import { SettingsService } from './app/shared/settings.service';
import { StorageService } from './app/storage.service';
import { AppEffects, appReducer, ExternalInformationEffects, externalInformationReducer, modeReducer } from './app/store';
import { ModeEffects } from './app/store/mode/mode.effects';
import { environment } from './environments/environment';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(
      BrowserModule,
      AppRoutingModule,
      NgCircleProgressModule.forRoot({
        // set defaults here
        radius: 40,
        outerStrokeWidth: 16,
        innerStrokeWidth: 8,
        outerStrokeColor: '#78C000',
        innerStrokeColor: '#C7E596',
        animationDuration: 300,
      }),
      FormsModule,
      ReactiveFormsModule,
    ),
    TaskService,
    NotificationService,
    StorageService,
    BugReportService,
    AlertService,
    SettingsService,
    CompatibilityService,
    OHModalService,
    DownloadService,
    NgbActiveModal,
    VersionCheckerService,
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    provideCharts(withDefaultRegisterables()),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideStore({
      app: appReducer,
      modes: modeReducer,
      externalInformation: externalInformationReducer,
    }),
    provideEffects(AppEffects, ModeEffects, ExternalInformationEffects),
    provideStoreDevtools({
      maxAge: 25, // Retains last 25 states
      logOnly: !isDevMode(), // Restrict extension to log-only mode
      autoPause: true, // Pauses recording actions and state changes when the extension window is not open
      trace: false, //  If set to true, will include stack trace for every dispatched action, so you can see it in trace tab jumping directly to that part of code
      traceLimit: 75, // maximum stack trace frames to be stored (in case trace option was provided as true)
      connectInZone: true, // If set to true, the connection is established within the Angular zone
    }),
  ],
}).catch((err) => console.error(err));
