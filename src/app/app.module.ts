import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

import { AppComponent } from './app.component';
import { PopoverComponent } from './components/popover/popover.component';
import { ContextMenuComponent } from './components/proceedings/context-menu/context-menu.component';
import { ExpandRowDirective } from './components/proceedings/expand-row.directive';
import { ProceedingsComponent } from './components/proceedings/proceedings.component';
import { ToolLoaderComponent } from './components/tool-loader/tool-loader.component';
import { ExpandDirective } from './expand.directive';
import { FilesizePipe } from './shared/filesize.pipe';
import { NotificationService } from './shared/notification.service';
import { TaskService } from './shared/tasks';
import { TimePipe } from './shared/time.pipe';


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
    PopoverComponent
  ],
  imports     : [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule
  ],
  providers   : [ TaskService, NotificationService ],
  bootstrap   : [ AppComponent ]
})
export class AppModule {
}
