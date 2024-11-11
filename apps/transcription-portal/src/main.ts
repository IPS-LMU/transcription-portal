import {enableProdMode, importProvidersFrom} from '@angular/core';


import {environment} from './environments/environment';
import {TaskService} from './app/obj/tasks/task.service';
import {NotificationService} from './app/shared/notification.service';
import {StorageService} from './app/storage.service';
import {BugReportService} from './app/shared/bug-report.service';
import {AlertService} from './app/shared/alert.service';
import {SettingsService} from './app/shared/settings.service';
import {CompatibilityService} from './app/shared/compatibility.service';
import {OHModalService} from './app/shared/ohmodal.service';
import {DownloadService} from './app/shared/download.service';
import {provideHttpClient, withInterceptorsFromDi} from '@angular/common/http';
import {bootstrapApplication, BrowserModule} from '@angular/platform-browser';
import {AppRoutingModule} from './app/app-routing.module';
import {provideAnimations} from '@angular/platform-browser/animations';
import {NgChartsModule} from 'ng2-charts';
import {TooltipModule} from 'ngx-bootstrap/tooltip';
import {ModalModule} from 'ngx-bootstrap/modal';
import {CollapseModule} from 'ngx-bootstrap/collapse';
import {PopoverModule} from 'ngx-bootstrap/popover';
import {BsDropdownModule} from 'ngx-bootstrap/dropdown';
import {NgCircleProgressModule} from 'ng-circle-progress';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {AppComponent} from './app/app.component';

if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserModule, AppRoutingModule, NgChartsModule, TooltipModule.forRoot(), ModalModule.forRoot(), CollapseModule.forRoot(), PopoverModule.forRoot(), BsDropdownModule.forRoot(), NgCircleProgressModule.forRoot({
            // set defaults here
            radius: 40,
            outerStrokeWidth: 16,
            innerStrokeWidth: 8,
            outerStrokeColor: '#78C000',
            innerStrokeColor: '#C7E596',
            animationDuration: 300
        }), FormsModule, ReactiveFormsModule),
        TaskService,
        NotificationService,
        StorageService,
        BugReportService,
        AlertService,
        SettingsService,
        CompatibilityService,
        OHModalService,
        DownloadService,
        provideHttpClient(withInterceptorsFromDi()),
        provideAnimations()
    ]
})
  .catch((err) => console.error(err));
