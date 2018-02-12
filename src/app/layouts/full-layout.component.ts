import { HttpService } from '../common/service/http.service';
import { AfterViewInit, Component, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { RegistryService } from '../common/service/registry.service';
import { LayoutStatusService } from '../common/service/layout-status.service';
import { SidebarToggleDirective } from '../shared/sidebar.directive';
import { MatDialog } from '@angular/material';

@Component( {
  selector: 'app-dashboard',
  templateUrl: './full-layout.component.html',
  styleUrls: ['./full-layout.component.css']
} )
export class FullLayoutComponent {

  public disabled: boolean = false;
  public status: { isopen: boolean } = { isopen: false };
  public show_header: boolean = true;  // ヘッダーを表示するか

  constructor (
                private httpService: HttpService,
                private router: Router,
                public  registryService: RegistryService,
                public  layoutStatusService: LayoutStatusService,
                public  dialog: MatDialog
  ) {
  }

  public toggled = function ( open: boolean ): void {
    console.log( this.sites );
    console.log( this.siteService.getActiveSite() );
    console.log( 'Dropdown is now: ', open );
  };

  public toggleDropdown = function ( $event: MouseEvent ): void {
    console.log( this.sites );
    $event.preventDefault();
    $event.stopPropagation();
    this.status.isopen = !this.status.isopen;
  };
  
  // ヘッダーを隠す
  public toggleHeader = ( event: MouseEvent ): void => {
    console.log('click header toggle');
    // デフォルトのイベントを止める
    event.preventDefault();
    event.stopPropagation();
    
    this.layoutStatusService.setShowHeader();
  };
  
  @ViewChild( SidebarToggleDirective ) sidebarToggleDirective: SidebarToggleDirective;
  
}
