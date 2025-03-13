/// <reference types="@angular/localize" />

import { enableProdMode, importProvidersFrom } from '@angular/core';

import {
  provideHttpClient,
  withInterceptorsFromDi,
} from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { bootstrapApplication, BrowserModule } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
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
    provideHttpClient(withInterceptorsFromDi()),
    provideAnimations(),
    provideCharts(withDefaultRegisterables()),
  ],
}).catch((err) => console.error(err));
