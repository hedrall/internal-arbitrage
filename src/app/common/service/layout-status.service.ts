import { Injectable } from '@angular/core';
import { RegistryService } from './registry.service';

// レイアウト情報を、共有・管理するサービス
@Injectable()
export class LayoutStatusService {

  public show_header:       boolean = true; // ヘッダーを見せるか
  public show_progress_bar: boolean = false; // プログレスバーを見せるか
  
  constructor() {
      this.show_header = localStorage.getItem( RegistryService.localStorageItemKeys.show_header ) === 'true'
  }
  
  // show_header情報を更新する
  public setShowHeader = (): void => {
    this.show_header = !this.show_header;
    localStorage.setItem( RegistryService.localStorageItemKeys.show_header, this.show_header.toString() );
  }

}
