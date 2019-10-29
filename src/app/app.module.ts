import {HttpClientModule} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';

import {AppComponent} from './app.component';
import {PopoverComponent} from './components/popover/popover.component';
import {ContextMenuComponent} from './components/proceedings/context-menu/context-menu.component';
import {ExpandRowDirective} from './components/proceedings/expand-row.directive';
import {ProceedingsComponent} from './components/proceedings/proceedings.component';
import {ToolLoaderComponent} from './components/tool-loader/tool-loader.component';
import {ExpandDirective} from './expand.directive';
import {FilesizePipe} from './shared/filesize.pipe';
import {NotificationService} from './shared/notification.service';
import {TimePipe} from './shared/time.pipe';
import {FileInfoTableComponent} from './components/file-info-table/file-info-table.component';
import {TaskService} from './obj/tasks/task.service';
import {StorageService} from './storage.service';
import {ResultsTableComponent} from './components/results-table/results-table.component';
import {FeedbackModalComponent} from './modals/feedback-modal/feedback-modal.component';
import {BugReportService} from './shared/bug-report.service';
import {SplitModalComponent} from './modals/split-modal/split-modal.component';
import {FirstModalComponent} from './modals/first-modal/first-modal.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {QueueModalComponent} from './modals/queue-modal/queue-modal.component';
import {ProtocolFooterComponent} from './components/protocol-footer/protocol-footer.component';
import {FilePreviewModalComponent} from './modals/file-preview-modal/file-preview-modal.component';
import {AlertComponent} from './components/alert/alert.component';
import {AlertService} from './shared/alert.service';
import {DownloadModalComponent} from './modals/download-modal/download-modal.component';
import {OperationArrowComponent} from './components/operation-arrow/operation-arrow.component';
import {ProceedingsRowDirective} from './components/proceedings/directives/proceedings-row.directive';
import {ProcColIconDirective} from './components/proceedings/directives/proc-col-icon.directive';
import {ProcColOperationDirective} from './components/proceedings/directives/proc-col-operation.directive';
import {NgCircleProgressModule} from 'ng-circle-progress';
import {DirProgressDirective} from './components/proceedings/directives/dir-progress.directive';
import {StatisticsModalComponent} from './modals/statistics-modal/statistics-modal.component';
import {ChartsModule} from 'ng2-charts';
import {SettingsService} from './shared/settings.service';
import {TooltipModule} from 'ngx-bootstrap/tooltip';
import {BsDropdownModule, CollapseModule, ModalModule, PopoverModule} from 'ngx-bootstrap';
import {BrowserTestComponent} from './components/browser-test/browser-test.component';
import {CompatibilityService} from './shared/compatibility.service';
import {routing} from './app.routes';
import {MainComponent} from './main/main.component';
import {OHModalService} from './shared/ohmodal.service';

@NgModule({
  declarations: [
    AppComponent,
    ToolLoaderComponent,
    ProceedingsComponent,
    TimePipe,
    ExpandRowDirective,
    FilesizePipe,
    ContextMenuComponent,
    ExpandDirective,
    PopoverComponent,
    FileInfoTableComponent,
    ResultsTableComponent,
    FeedbackModalComponent,
    SplitModalComponent,
    FirstModalComponent,
    QueueModalComponent,
    ProtocolFooterComponent,
    FilePreviewModalComponent,
    AlertComponent,
    DownloadModalComponent,
    OperationArrowComponent,
    ProceedingsRowDirective,
    ProcColIconDirective,
    ProcColOperationDirective,
    DirProgressDirective,
    StatisticsModalComponent,
    BrowserTestComponent,
    MainComponent
  ],
  imports: [
    BrowserModule,
    routing,
    BrowserAnimationsModule,
    HttpClientModule,
    ChartsModule,
    TooltipModule.forRoot(),
    ModalModule.forRoot(),
    CollapseModule.forRoot(),
    PopoverModule.forRoot(),
    BsDropdownModule.forRoot(),
    NgCircleProgressModule.forRoot({
      // set defaults here
      radius: 40,
      outerStrokeWidth: 16,
      innerStrokeWidth: 8,
      outerStrokeColor: '#78C000',
      innerStrokeColor: '#C7E596',
      animationDuration: 300
    }),
    FormsModule,
    ReactiveFormsModule
  ],
  providers: [
    TaskService,
    NotificationService,
    StorageService,
    BugReportService,
    AlertService,
    SettingsService,
    CompatibilityService,
    OHModalService
  ],
  bootstrap: [AppComponent]
})
export class AppModule {
}
