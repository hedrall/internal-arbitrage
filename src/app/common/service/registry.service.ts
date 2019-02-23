import { Injectable } from '@angular/core';

@Injectable()
export class RegistryService {

  constructor (
  ) { }
  
  public api: object = {
    zaif: {
      base: 'https://api.zaif.jp/api/1',
      currency_pairs:    'currency_pairs',
      depth:             'depth',
      last_price:        'last_price',
      get_personal_info: 'get_personal_info',
      get_info:          'get_info',
      trades:            'trades',
      trade:             'trade',
    }
  };
  
  public currency_pair: object;
  
  public static localStorageItemKeys = {
    is_slider:                'is_slider',
    gutterPosition:           'gutterPosition',
    authorizations:           'authorizations',
    user_name:                'user_name',
    hash_password:            'hash_password',
    show_header:              'show_header'
  };
}
