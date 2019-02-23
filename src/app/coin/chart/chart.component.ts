import { Component, EventEmitter } from '@angular/core';
import { HttpService } from '../../common/service/http.service';
import { MatSelectChange } from '@angular/material';
import moment = require('moment');
import { HttpErrorResponse } from '@angular/common/http';
import { ZaifCurrency } from '../models/zaif/currencies';
import { ZaifDepth } from '../models/zaif/depth';
import { GetInfo } from '../models/zaif/get_info';
import { TradeResult } from '../models/zaif/trade';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css']
})
export class ChartComponent {
  
  public currency_pairs = {
    zaif: {
      all_pairs: [],
      selected_pair: { // 選択している通過の情報
        all:                 null,
        name:                '',              // 選択した通過ペアの名前 ex) nem_jpy
        depth:               new ZaifDepth(), // 板情報
        disp_depth:          new ZaifDepth(), // 画面に表示する板情報 (ask, bid共に5件ずつ )
        disp_depth_sorted:   new ZaifDepth(), // 画面に表示する板情報 (askを反転ソート済み )
        last_price:          0,               // 最後の取引価格
        with_btc_name:       '',              // 選択した通過のBTCでの取引名 ex) xem_btc
        last_price_with_btc: 0,               // BTCでの最後の取引価格
        btc_price_to_jpy:    0,               // BTCで購入した場合日本円でいくらに相当するか
        complete_requests:   Array<string>(), // 完了下リクエスト一覧
        need_requests: { // 次の処理にすすむために必要な、lsat_priceの共通情報
          btc_jpy_on_average: 'btc_jpy_on_average', // BTCの時間平均価格
        },
        last_updated: '',  // 最終更新時間
      }
    }
  };
  
  public config = {
    amount: 100, // 一回の取引で使用する額 (JPY)
    amount_list: [100, 1000, 10000, 50000, 100000, 20000]
  };
  
  public btc_jpy = { // BTC系の情報
    zaif: {
      last_price_on_average: 0,           // 取引価格の時間平均値
      interval: 10,                       // 平均する間隔 (s足)
      depth:             new ZaifDepth(), // BTCの板情報
      disp_depth:        new ZaifDepth(), // 板情報の表示する領域
      disp_depth_sorted: new ZaifDepth()  // askを反転ソートした
    }
  };
  
  public intervals = { // タイマー系を一元管理
    zaif: {
      last_price: null, // インターバル
      interval:   5000, // インターバルの間隔
      depth:      null
    }
  };
  
  public emitters = { // イベントエミッターを一元管理
    zaif: {
      price:            new EventEmitter<string>(), // last_priceの取得
      all_price_loaded: new EventEmitter<void>(),   // 全てのlast_priceが取得済み
      depth:            new EventEmitter<string>()  // 全ての板情報が取得済み
    },
  };
  
  // 取引情報
  public trade = {
    average_asks_on_jpy: { // JPY売り
      price: 0,
      balance: 0,        // 余り（端数による）
      price_history: [], // 売却価格の履歴
      amount_history: [] // 売却量の履歴
    },
    average_asks_on_btc: { // BTC売り
      price: 0,
      balance: 0, // 余り（端数による）
      price_history: [],
      amount_history: []
    },
    average_bids_on_jpy: { // JPY買い
      price: 0,
      balance: 0, // 余り（端数による）
      price_history: [],
      amount_history: []
    },
    average_bids_on_btc: { // BTC買い
      price: 0,
      balance: 0, // 余り（端数による）
      price_history: [],
      amount_history: []
    }
  };
  
  // 板情報で行う内部アービトラージの情報
  public internal_arbitrage_on_depth = {
    jpy_to_btc: 0,               // JPY買い、BTC売りの総額
    jpy_to_btc_on_unit: 0,       // JPY買い、BTC売りの単価
    jpy_to_btc_on_percentage: 0, // JPY買い、BTC売りの利益率
    jpy_to_btc_total_price: 0,   // JPY買い、BTC売りの総額(JPY)
    jpy_to_btc_total_amount: 0,  // JPY買い、BTC売りの取引総数(coin)
    btc_to_jpy: 0,
    btc_to_jpy_on_unit: 0,
    btc_to_jpy_on_percentage: 0,
    btc_to_jpy_total_price: 0,
    btc_to_jpy_total_amount: 0,
  };
  
  public info = { // 各種情報
    get_info: new GetInfo(), // 自分の資産情報
    get_info_last_update: '' // 上記の再取得時間
  };
  
  // 最終計算時刻
  public internal_arbitrage_last_update = moment().format( 'M月DD日 HH時mm分ss秒' );
  
  // APIリクエストの結果(以上系）
  public interval_arbitrage_execute_message = [];
  
  public manual_trade = {
    zaif: {
      selected_pair: '',
      price: 0,
      amount: 0
    }
  };
  
  constructor(
    private httpService: HttpService
  ) {
    // 全てのcurrency_pairを取得
    this.httpService.doHttp( 'zaif', 'currency_pairs', {}, 'Get', 'default', 'all' ).subscribe( ( currencies: Array<ZaifCurrency> ) => {
      this.currency_pairs.zaif.all_pairs = currencies.filter( ( exchange ) => {
        return exchange['name'].match( /XEM\/JPY|PEPECASH\/JPY|ETH\/JPY|XCP\/JPY/ ); // XEM, PEPECACHE だけ見る
      });
    });
  }
  
  // currency_pairを選択した時の処理
  // 各種情報をセット
  public selectCurrencyPairOfDepth = ( event: MatSelectChange ) => {
    // 古いインターバルを削除
    if ( this.intervals.zaif.last_price ) {
      clearInterval( this.intervals.zaif.last_price );
    }
    
    // 選択した通貨の情報を反映
    this.currency_pairs.zaif.selected_pair.all = event.value;
    this.currency_pairs.zaif.selected_pair.name = event.value['currency_pair'];
    this.currency_pairs.zaif.selected_pair.with_btc_name =
      this.currency_pairs.zaif.selected_pair.name.replace('_jpy', '_btc');
    
    // 選択したcurrency_pairのlast_priceを定期的に取得
    this.intervals.zaif.last_price = setInterval( () => {
  
      // BTC / JPY の平均価格を取得
      this.httpService.doHttp( 'zaif', 'trades', {}, 'Get', 'default', 'btc_jpy' ).subscribe( ( result ) => {
          const btc_jpy_trades = result;
          const now_unix_time = moment().unix();
          let total_amount = 0;
          let total_price = 0;
          for ( const key in btc_jpy_trades ) {
            if ( btc_jpy_trades.hasOwnProperty(key) ) {
              if ( ( now_unix_time - btc_jpy_trades[key]['date'] ) > this.btc_jpy.zaif.interval ) {
                break;
              }
              total_amount += btc_jpy_trades[key].amount;
              total_price += btc_jpy_trades[key].amount * btc_jpy_trades[key].price;
            }
          }
          if ( total_amount !== 0 ) {
            this.btc_jpy.zaif.last_price_on_average = this.roundOnEighthDigit( total_price / total_amount );
          } else {
            this.btc_jpy.zaif.last_price_on_average = btc_jpy_trades[0].price;
          }
          console.log('端数計算');
          // 5刻みの値に変換する
          let fraction = this.btc_jpy.zaif.last_price_on_average % 5;
          fraction += fraction > 2.5 ? -5 : 0;
          this.btc_jpy.zaif.last_price_on_average -= fraction;
          
          this.emitters.zaif.price.emit( this.currency_pairs.zaif.selected_pair.need_requests.btc_jpy_on_average );
        },
        ( error: HttpErrorResponse ) => {
          clearInterval( this.intervals.zaif.last_price );
          return;
        });
    }, this.intervals.zaif.interval );
    
    this.emitters.zaif.price.subscribe( ( result: string ): void => {
      if ( this.currency_pairs.zaif.selected_pair.complete_requests.indexOf( result ) === -1 ) {
        this.currency_pairs.zaif.selected_pair.complete_requests.push( result );
      }
      if (
        this.currency_pairs.zaif.selected_pair.complete_requests.indexOf(
          this.currency_pairs.zaif.selected_pair.need_requests.btc_jpy_on_average
        ) !== -1
      ) {
        this.emitters.zaif.all_price_loaded.emit();
      }
    });
    
    // 板情報系の処理
    // 初期化
    
    // 選択されたコインのJPYとBTCの板情報を取得
    this.emitters.zaif.all_price_loaded.subscribe( () => {
      // JPY
      this.httpService.doHttp( 'zaif', 'depth', {}, 'Get',
        'default', this.currency_pairs.zaif.selected_pair.name ).subscribe( ( depth: ZaifDepth ) => {
        this.currency_pairs.zaif.selected_pair.depth = depth;
        this.emitters.zaif.depth.emit( 'JPY' )
      } );
      
      // BTC
      this.httpService.doHttp( 'zaif', 'depth', {}, 'Get',
        'default', this.currency_pairs.zaif.selected_pair.with_btc_name ).subscribe( ( depth: ZaifDepth ) => {
          for (const key in depth.asks ) {
            if ( depth.asks.hasOwnProperty( key ) ) {
              depth.asks[key].push( depth.asks[key][0] * this.btc_jpy.zaif.last_price_on_average );
            }
          }
          for (const key in depth.bids ) {
            if ( depth.bids.hasOwnProperty( key ) ) {
              depth.bids[key].push( depth.bids[key][0] * this.btc_jpy.zaif.last_price_on_average );
            }
          }
        this.btc_jpy.zaif.depth = depth;
        this.emitters.zaif.depth.emit( 'BTC' )
      } );
    });
    
    // 全ての板情報取得終了を待つ
    let loaded_depth = [];
    this.emitters.zaif.depth.subscribe( ( name: string ) => {
      if ( loaded_depth.indexOf( name ) === -1 ) {
        loaded_depth.push( name )
      }
      if (
        loaded_depth.indexOf( 'JPY' ) !== -1 &&
        loaded_depth.indexOf( 'BTC' ) !== -1
      ) {
        loaded_depth = [];
        // 全ての板情報の取得が終わってる
        // 板情報の表示する部分を作成（全部だと多すぎるから）
        this.currency_pairs.zaif.selected_pair.disp_depth.asks   = this.currency_pairs.zaif.selected_pair.depth.asks.slice( 0, 5 );
        this.currency_pairs.zaif.selected_pair.disp_depth.bids   = this.currency_pairs.zaif.selected_pair.depth.bids.slice( 0, 5 );
        this.currency_pairs.zaif.selected_pair.disp_depth_sorted =
          JSON.parse( JSON.stringify( this.currency_pairs.zaif.selected_pair.disp_depth ) );
        this.currency_pairs.zaif.selected_pair.disp_depth_sorted.asks =
          this.currency_pairs.zaif.selected_pair.disp_depth_sorted.asks.sort( ( a, b ) => {
            if ( a > b ) { return -1 }
            if ( a < b ) { return 1 }
            return 0;
          });
        this.btc_jpy.zaif.disp_depth.asks = this.btc_jpy.zaif.depth.asks.slice( 0, 5 );
        this.btc_jpy.zaif.disp_depth.bids = this.btc_jpy.zaif.depth.bids.slice( 0, 5 );
        this.btc_jpy.zaif.disp_depth_sorted = JSON.parse( JSON.stringify( this.btc_jpy.zaif.disp_depth ) );
        this.btc_jpy.zaif.disp_depth_sorted.asks =
          this.btc_jpy.zaif.disp_depth_sorted.asks.sort( ( a, b ) => {
            if ( a > b ) { return -1 }
            if ( a < b ) { return 1 }
            return 0;
          });
        
        // コイン_JPY板買いの平均価格を算出する
        console.log( '@@@@@@@ JPY購入のセクション' );
        // まずはどこまで買えるかを調査
        let balance: number                 = this.config.amount; // 残高
        let last_balance: number            = 0; // 最終残高
        let amount_histories: Array<number> = new Array<number>();
        let price_histories: Array<number>  = new Array<number>();
        let complete: boolean               = false; // 取引可能か
        for ( const key in this.currency_pairs.zaif.selected_pair.disp_depth.asks ) {
          if ( this.currency_pairs.zaif.selected_pair.disp_depth.asks.hasOwnProperty( key ) ) {
            const price    = this.currency_pairs.zaif.selected_pair.disp_depth.asks[key][0];
            const amount   = this.currency_pairs.zaif.selected_pair.disp_depth.asks[key][1];
            let bid_amount = price * amount; // 板上の売りの量
            bid_amount     = this.roundOnEighthDigit( price * amount );
            if ( bid_amount >= balance ) { // 買いきった
              // 買える量を算出(端数が細かいと注文できないので)
              const valid_amount = Math.floor( balance / price ); // NEMの最小単位は1
              amount_histories.push( valid_amount );
              price_histories.push( price );
              balance -= valid_amount * price;
              // 最終残高(端数)を決定。1/10000以下は無視する
              balance = Math.floor( balance );
              if ( balance === 0 ) { break; }
              this.trade.average_asks_on_jpy.balance = balance;
              complete                               = true;
              break;
            } else { // もっと買える
              const history = {
                amount: amount,
                price: price
              };
              amount_histories.push( amount );
              price_histories.push( price );
              balance = this.roundOnEighthDigit( balance - bid_amount );
            }
          }
        }
        if ( complete ) {
          
          this.trade.average_asks_on_jpy.price_history = price_histories;
          this.trade.average_asks_on_jpy.amount_history = amount_histories;
          // 平均金額を出す
          let total_price: number  = 0;
          let total_amount: number = 0;
          for ( const key in amount_histories ) {
            if ( amount_histories.hasOwnProperty( key ) ) {
              total_price += amount_histories[key] * price_histories[key];
              total_amount += amount_histories[key];
            }
          }
          // ^8以下の数字を落とす
          total_price  = this.roundOnEighthDigit( total_price );
          total_amount = this.roundOnEighthDigit( total_amount );
          this.internal_arbitrage_on_depth.jpy_to_btc_total_price = total_price;
          this.internal_arbitrage_on_depth.jpy_to_btc_total_amount = total_amount;
          this.trade.average_asks_on_jpy.price = this.roundOnEighthDigit( total_price / total_amount );
        }
        
        // コイン_btc板買いの平均価格を算出する
        // まずはどこまで買えるかを調査
        console.log( '@@@@@@@ BTC購入のセクション' );
        balance          = this.roundOnEighthDigit( this.config.amount / this.btc_jpy.zaif.last_price_on_average ); // 残高はBTCで計算
        last_balance     = 0;                   // 最終残高
        amount_histories = new Array<number>();
        price_histories  = new Array<number>();
        complete         = false;               // 取引可能か
        for ( const key in this.btc_jpy.zaif.disp_depth.asks ) {
          if ( this.btc_jpy.zaif.disp_depth.asks.hasOwnProperty( key ) ) {
            const price    = this.btc_jpy.zaif.disp_depth.asks[key][0];
            const amount   = this.btc_jpy.zaif.disp_depth.asks[key][1];
            let bid_amount = price * amount; // 板上の売りの量
            bid_amount     = this.roundOnEighthDigit( price * amount );
            if ( bid_amount >= balance ) { // 買いきった
              // 買える量を算出(端数が細かいと注文できないので)
              const valid_amount = Math.floor( balance / price ); // nemの最小単位は1
              if ( balance === 0 ) { break; }
              amount_histories.push( valid_amount );
              price_histories.push( price );
              balance -= valid_amount * price;
              // 最終残高(端数)を決定
              balance                                = this.roundOnEighthDigit( balance );
              this.trade.average_asks_on_btc.balance = balance;
              complete                               = true;
              break;
            } else { // もっと買える
              const history = {
                amount: amount,
                price: price
              };
              amount_histories.push( amount );
              price_histories.push( price );
              balance = this.roundOnEighthDigit( balance - bid_amount );
            }
          }
        }
        if ( complete ) {
          this.trade.average_asks_on_btc.price_history = price_histories;
          this.trade.average_asks_on_btc.amount_history = amount_histories;
          
          // 平均金額を出す
          let total_price: number  = 0;
          let total_amount: number = 0;
          for ( const key in amount_histories ) {
            if ( amount_histories.hasOwnProperty( key ) ) {
              total_price += amount_histories[key] * price_histories[key];
              total_amount += amount_histories[key];
            }
          }
          // ^8以下の数字を落とす
          total_price  = Math.floor( (total_price) * 100000000 ) / 100000000;
          total_amount = Math.floor( ( total_amount) * 100000000 ) / 100000000;
          this.internal_arbitrage_on_depth.btc_to_jpy_total_price = total_price * this.btc_jpy.zaif.last_price_on_average;
          this.internal_arbitrage_on_depth.btc_to_jpy_total_amount = total_amount;
          this.trade.average_asks_on_btc.price = this.roundOnEighthDigit( total_price / total_amount );
        }
        
        // コイン_btc板買いの平均価格を算出する
        // まずはどこまで買えるかを調査
        console.log( '@@@@@@@ JPY売却のセクション' );
        // BTC購入セクションで購入した数
        balance          = this.roundOnEighthDigit( this.internal_arbitrage_on_depth.btc_to_jpy_total_amount ); // コイン残高 )
        last_balance     = 0;                   // 最終残高
        amount_histories = new Array<number>();
        price_histories  = new Array<number>();
        complete         = false;               // 取引可能か
        for ( const key in this.currency_pairs.zaif.selected_pair.disp_depth.bids ) {
          if ( this.currency_pairs.zaif.selected_pair.disp_depth.asks.hasOwnProperty( key ) ) {
            const price    = this.currency_pairs.zaif.selected_pair.disp_depth.bids[key][0];
            const amount   = this.currency_pairs.zaif.selected_pair.disp_depth.bids[key][1];
            let ask_amount = price * amount; // 板上の売りの量
            ask_amount     = this.roundOnEighthDigit( price * amount );
            if ( amount >= balance ) { // 売りきった
              // 買える量を算出(端数が細かいと注文できないので)
              const valid_amount = Math.floor( balance * 10000 ) / 10000;
              amount_histories.push( valid_amount );
              price_histories.push( price );
              // 最終残高(端数)を決定
              balance -= valid_amount;
              balance                                = this.roundOnEighthDigit( balance );
              this.trade.average_bids_on_jpy.balance = balance;
              complete                               = true;
              break;
            } else { // もっと買える
              const history = {
                amount: amount,
                price: price
              };
              amount_histories.push( amount );
              price_histories.push( price );
              balance = this.roundOnEighthDigit( balance - amount );
            }
          }
        }
        if ( complete ) {
          this.trade.average_bids_on_jpy.price_history = price_histories;
          this.trade.average_bids_on_jpy.amount_history = amount_histories;
          
          // 平均金額を出す
          let total_price: number  = 0;
          let total_amount: number = 0;
          for ( const key in amount_histories ) {
            if ( amount_histories.hasOwnProperty( key ) ) {
              total_price += amount_histories[key] * price_histories[key];
              total_amount += amount_histories[key];
            }
          }
          // ^8以下の数字を落とす
          total_price  = Math.floor( (total_price) * 100000000 ) / 100000000;
          total_amount = Math.floor( ( total_amount) * 100000000 ) / 100000000;
          this.trade.average_bids_on_jpy.price = this.roundOnEighthDigit( total_price / total_amount );
        }
        
        // コイン_btc板買いの平均価格を算出する
        // まずはどこまで買えるかを調査
        console.log( '@@@@@@@ BTC売却のセクション' );
        // 残高はJPY購入セクションで実際に購入した数
        balance          = this.roundOnEighthDigit( this.internal_arbitrage_on_depth.jpy_to_btc_total_amount ); // コイン残高
        last_balance     = 0;                   // 最終残高
        amount_histories = new Array<number>();
        price_histories  = new Array<number>();
        complete         = false;               // 取引可能か
        for ( const key in this.btc_jpy.zaif.disp_depth.bids ) {
          if ( this.btc_jpy.zaif.disp_depth.asks.hasOwnProperty( key ) ) {
            const price    = this.btc_jpy.zaif.disp_depth.bids[key][0];
            const amount   = this.btc_jpy.zaif.disp_depth.bids[key][1];
            let ask_amount = price * amount; // 板上の売りの量
            ask_amount     = this.roundOnEighthDigit( price * amount );
            if ( amount >= balance ) { // 売りきった
              // 買える量を算出(端数が細かいと注文できないので)
              const valid_amount = Math.floor( balance * 10000 ) / 10000;
              amount_histories.push( valid_amount );
              price_histories.push( price );
              // 最終残高(端数)を決定
              balance -= valid_amount;
              balance                                = this.roundOnEighthDigit( balance );
              this.trade.average_bids_on_btc.balance = balance;
              complete                               = true;
              break;
            } else { // もっと買える
              const history = {
                amount: amount,
                price: price
              };
              amount_histories.push( amount );
              price_histories.push( price );
              balance = this.roundOnEighthDigit( balance - amount );
            }
          }
        }
        if ( complete ) {
          this.trade.average_bids_on_btc.price_history = price_histories;
          this.trade.average_bids_on_btc.amount_history = amount_histories;
          
          // 平均金額を出す
          let total_price: number  = 0;
          let total_amount: number = 0;
          for ( const key in amount_histories ) {
            if ( amount_histories.hasOwnProperty( key ) ) {
              total_price += amount_histories[key] * price_histories[key];
              total_amount += amount_histories[key];
            }
          }
          // ^8以下の数字を落とす
          total_price  = Math.floor( (total_price) * 100000000 ) / 100000000;
          total_amount = Math.floor( ( total_amount) * 100000000 ) / 100000000;
          this.trade.average_bids_on_btc.price = this.roundOnEighthDigit( total_price / total_amount );
        }
        
        // 総決算
        // JPY買い, BTC売り
        this.internal_arbitrage_on_depth.jpy_to_btc_on_unit =
          this.trade.average_bids_on_btc.price * this.btc_jpy.zaif.last_price_on_average - this.trade.average_asks_on_jpy.price;
        this.internal_arbitrage_on_depth.jpy_to_btc =
          this.internal_arbitrage_on_depth.jpy_to_btc_on_unit * this.internal_arbitrage_on_depth.jpy_to_btc_total_amount;
        this.internal_arbitrage_on_depth.jpy_to_btc_on_percentage =
          this.internal_arbitrage_on_depth.jpy_to_btc / this.internal_arbitrage_on_depth.jpy_to_btc_total_price * 100;
        
        // BTC買い, JPY売り
        this.internal_arbitrage_on_depth.btc_to_jpy_on_unit =
          this.trade.average_bids_on_jpy.price - this.trade.average_asks_on_btc.price * this.btc_jpy.zaif.last_price_on_average;
        this.internal_arbitrage_on_depth.btc_to_jpy =
          this.internal_arbitrage_on_depth.btc_to_jpy_on_unit * this.internal_arbitrage_on_depth.btc_to_jpy_total_amount;
        this.internal_arbitrage_on_depth.btc_to_jpy_on_percentage =
          this.internal_arbitrage_on_depth.btc_to_jpy / this.internal_arbitrage_on_depth.btc_to_jpy_total_price * 100;
        this.internal_arbitrage_last_update = moment().format( 'M月DD日 HH時mm分ss秒' );
      }
    });
  };
  
  public executeArbitrage = ( type: string ) => { // jpy_to_btc or btc_to_jpy
    this.stop();
    this.interval_arbitrage_execute_message  = [];
    if ( type === 'jpy_to_btc' ) {
      for ( const key in this.trade.average_asks_on_jpy.price_history ) { // JPYで購入
        if ( this.trade.average_asks_on_jpy.price_history.hasOwnProperty( key ) ) {
          this.interval_arbitrage_execute_message.push( {
            currency_pair: this.currency_pairs.zaif.selected_pair.name,
            action: 'ask',
            price: this.trade.average_asks_on_jpy.price_history[key],
            amount: this.trade.average_asks_on_jpy.amount_history[key],
            btc_price: this.btc_jpy.zaif.last_price_on_average
          } );
          this.httpService.doHttp( 'zaif', 'trade', {
            currency_pair: this.currency_pairs.zaif.selected_pair.name,
            action: 'ask',
            price: this.trade.average_asks_on_jpy.price_history[key],
            amount: this.trade.average_asks_on_jpy.amount_history[key]
          }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
            console.log( trade_result );
            for ( const key in this.trade.average_bids_on_btc.price_history ) { // BTCで売却
              if ( this.trade.average_bids_on_btc.price_history.hasOwnProperty( key ) ) {
                this.interval_arbitrage_execute_message.push( {
                  currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
                  action: 'bid',
                  price: this.trade.average_bids_on_btc.price_history[key],
                  amount: this.trade.average_bids_on_btc.amount_history[key],
                  btc_price: this.btc_jpy.zaif.last_price_on_average
                } );
                this.httpService.doHttp( 'zaif', 'trade', {
                  currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
                  action: 'bid',
                  price: this.trade.average_bids_on_btc.price_history[key],
                  amount: this.trade.average_bids_on_btc.amount_history[key]
                }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
                  console.log( trade_result );
                }, ( error ) => {
                  console.log( error );
                } );
              }
            }
          }, ( error ) => {
            console.log( error );
          } );
        }
      }
    } else if ( type === 'btc_to_jpy' ) {
      for ( const key in this.trade.average_asks_on_btc.price_history ) { // BTCで購入
        if ( this.trade.average_asks_on_btc.price_history.hasOwnProperty( key ) ) {
          this.interval_arbitrage_execute_message.push( {
            currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
            action: 'ask',
            price: this.trade.average_asks_on_btc.price_history[key],
            amount: this.trade.average_asks_on_btc.amount_history[key],
            btc_price: this.btc_jpy.zaif.last_price_on_average
          } );
          this.httpService.doHttp( 'zaif', 'trade', {
            currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
            action: 'ask',
            price: this.trade.average_asks_on_btc.price_history[key],
            amount: this.trade.average_asks_on_btc.amount_history[key]
          }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
            console.log( trade_result );
            for ( const key in this.trade.average_bids_on_jpy.price_history ) { // JPYで売却
              if ( this.trade.average_bids_on_jpy.price_history.hasOwnProperty( key ) ) {
                this.interval_arbitrage_execute_message.push( {
                  currency_pair: this.currency_pairs.zaif.selected_pair.name,
                  action: 'bid',
                  price: this.trade.average_bids_on_jpy.price_history[key],
                  amount: this.trade.average_bids_on_jpy.amount_history[key],
                  btc_price: this.btc_jpy.zaif.last_price_on_average
                } );
                this.httpService.doHttp( 'zaif', 'trade', {
                  currency_pair: this.currency_pairs.zaif.selected_pair.name,
                  action: 'bid',
                  price: this.trade.average_bids_on_jpy.price_history[key],
                  amount: this.trade.average_bids_on_jpy.amount_history[key]
                }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
                  console.log( trade_result );
                }, ( error ) => {
                  console.log( error );
                } );
              }
            }
          }, ( error ) => {
            console.log( error );
          } );
        }
      }
    }
  };
  
  // 一回の取引で使用する額
  public selectTradeAmount = ( event: MatSelectChange ) => {
    this.config.amount = event.value;
  };
  
  public getInfo = () => {
    this.httpService.doHttp( 'zaif', 'get_info', {}, 'Post', 'default' ).subscribe( ( get_info: GetInfo ) => {
      this.info.get_info = get_info;
      this.info.get_info_last_update = moment().format( 'M月DD日 HH時mm分ss秒' );
    },
      ( error: HttpErrorResponse ) => {
        clearInterval( this.intervals.zaif.last_price );
        return;
      });
  };
  
  // 処理を停止する
  public stop = () => {
    clearInterval( this.intervals.zaif.last_price );
  };
  
  // 手動で取引する場合
  public manualTradeCurrencyOnJpy = ( type: string ) => { // 選択している通貨を日本円で取引
    if (!type || !this.manual_trade.zaif.price || !this.manual_trade.zaif.amount ) {
      return;
    }
    this.httpService.doHttp( 'zaif', 'trade', {
      currency_pair: this.manual_trade.zaif.selected_pair,
      action: type,
      price: this.manual_trade.zaif.price,
      amount: this.manual_trade.zaif.amount
    }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
      console.log( trade_result );
    }, ( error ) => {
      console.log( error );
    });
  };
  
  // 8桁に丸める
  public roundOnEighthDigit = ( num: number ): number => {
    return Math.round( num * 100000000 ) / 100000000;
  };
  
  public get_keys = ( obj: object ) => {
    return Object.keys( obj );
  };
}


