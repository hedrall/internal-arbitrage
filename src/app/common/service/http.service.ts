import { Injectable } from '@angular/core';
import { Http, Request, URLSearchParams, RequestOptionsArgs, RequestOptions, Headers } from '@angular/http';
import 'rxjs/add/operator/map';
import { Observable } from 'rxjs/Observable';
import { RegistryService } from './registry.service';

@Injectable()
export class HttpService {

  constructor(
    private http: Http,
    private registryService: RegistryService
  ) {}

  // http通信を実行する関数群をまとめたもの
  public doHttp( exchange: string, api_type: string, params = {}, method = 'Get', style = 'default', param_in_path = ''): Observable<any> {
    const options: RequestOptions = this.makeRequestConfig(exchange, api_type, params, method, style, param_in_path);
    return this.fetch(options);
  }

  // リクエスト用途の設定（パラメータなど）を行う
  private makeRequestConfig( exchange: string, api_type: string, params = {},
                            method: string, style = 'default', param_in_path = ''): RequestOptions {
    const param = new URLSearchParams();
    if (params !== {}) {
      if ( style === 'default') {
        for (const key in params) {
          if ( params.hasOwnProperty( key ) ) {
            param.set(key, params[key]);
          }
        }
      } else if (style === 'json') {
        for ( const key in params ) {
          if ( params.hasOwnProperty( key ) ) {
            param.set( key, JSON.stringify( params[key] ) );
          }
        }
      }
    }

    // ヘッダーを設定
    const headers: Headers = new Headers();
    headers.append('Content-Type', 'application/x-www-form-urlencoded');

    // 通信設定オブジェクト作成
    if (param_in_path !== '') {
      param_in_path = '/' + param_in_path;
    }
    const options: RequestOptionsArgs = {
      method: method,
      url: this.registryService.api[exchange]['base'] + '/' + this.registryService.api[exchange][api_type] + param_in_path,
      headers: headers
    };

    if (method === 'Get') {
      options.params = param;
    } else if (method === 'Post') {
      options.body = param.toString();
    }

    return new RequestOptions(options);
  }

  // httpリクエストを実行する
  private fetch(options: RequestOptions): Observable<any> {
    return this.http.request(new Request(options)).map( res => res.json() );
  }

}
