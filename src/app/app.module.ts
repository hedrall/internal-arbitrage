import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { LocationStrategy, CommonModule, PathLocationStrategy } from '@angular/common';

import { AppComponent } from './app.component';
import { BsDropdownModule } from 'ngx-bootstrap/dropdown';
import { TabsModule } from 'ngx-bootstrap/tabs';
import { NAV_DROPDOWN_DIRECTIVES } from './shared/nav-dropdown.directive';

import { SIDEBAR_TOGGLE_DIRECTIVES } from './shared/sidebar.directive';
import { AsideToggleDirective } from './shared/aside.directive';
import { BreadcrumbsComponent } from './shared/breadcrumb.component';

// Routing Module
import { AppRoutingModule } from './app.routing';

// Layouts
import { FullLayoutComponent } from './layouts/full-layout.component';
import { FormsModule} from '@angular/forms';
import { RegistryService } from './common/service/registry.service';
import { LayoutStatusService } from './common/service/layout-status.service';
import { NgModule } from '@angular/core';
import { ModalModule } from 'ngx-bootstrap';
import { ConfirmDialogComponent } from './layouts/confirm-dialog/confirm-dialog.component';
import { MatDialog, MatDialogModule, MatProgressBarModule } from '@angular/material';
import { ToasterModule } from 'angular2-toaster';
import { ChartModule } from './coin/chart/chart.module';
import { HttpService } from './common/service/http.service';
import { HttpModule } from '@angular/http';

@NgModule({
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpModule,
    AppRoutingModule,
    BsDropdownModule.forRoot(),
    TabsModule.forRoot(),
    BrowserModule,
    FormsModule,
    CommonModule,
    ModalModule.forRoot(), MatDialogModule, MatProgressBarModule,
    ToasterModule,
    ChartModule
  ],
  declarations: [
    AppComponent,
    FullLayoutComponent,
    NAV_DROPDOWN_DIRECTIVES,
    BreadcrumbsComponent,
    SIDEBAR_TOGGLE_DIRECTIVES,
    AsideToggleDirective,
    ConfirmDialogComponent,
  ],
  providers: [
    {
      provide: LocationStrategy,
      useClass: PathLocationStrategy,
    },
    RegistryService,
    LayoutStatusService,
    MatDialog,
    HttpService
  ],
  bootstrap: [ AppComponent ],
  entryComponents: [ // Lazy Loadingのコンポーネント
    ConfirmDialogComponent
  ]
})
export class AppModule { }
