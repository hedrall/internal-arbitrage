import { Component, EventEmitter } from '@angular/core';
import { HttpService } from '../../common/service/http.service';
import { MatSelectChange } from '@angular/material';
import * as moment from 'moment';
import { HttpErrorResponse } from '@angular/common/http';
import { ZaifDepth } from '../models/zaif/depth';
import { GetInfo } from '../models/zaif/get_info';
import { TradeResult, ZaifTrade } from '../models/zaif/trade';
import { ZaifCurrencyPair } from 'app/coin/models/zaif/currency_pairs';
import { Observable } from 'rxjs/Observable';
import { combineLatest } from 'rxjs/observable/combineLatest';

@Component({
  selector: 'app-chart',
  templateUrl: './chart.component.html',
  styleUrls: ['./chart.component.css']
})
export class ChartComponent {
  
  public currency_pairs = {
    zaif: {
      all_pairs: [],
      original: [],
      selected_pair: { // 選択している通過の情報
        all:                 new ZaifCurrencyPair({}), // 選択したペアそのもののオブジェクト
        name:                '',              // 選択した通過ペアの名前 ex) nem_jpy
        depth:               new ZaifDepth({}), // 板情報
        disp_depth:          new ZaifDepth({}), // 画面に表示する板情報 (ask, bid共に5件ずつ )
        disp_depth_sorted:   new ZaifDepth({}), // 画面に表示する板情報 (askを反転ソート済み )
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
      depth:             new ZaifDepth({}), // BTCの板情報
      disp_depth:        new ZaifDepth({}), // 板情報の表示する領域
      disp_depth_sorted: new ZaifDepth({})  // askを反転ソートした
    }
  };
  
  public intervals = { // タイマー系を一元管理
    zaif: {
      last_price: null, // 最後の価格を取得するインターバル
      interval:   5000, // インターバルの間隔
      depth:      null
    }
  };
  
  public emitters = { // イベントエミッターを一元管理
    zaif: {
      price:            new EventEmitter<string>(), // last_priceの取得
      got_btc_jpy_price: new EventEmitter(),
      all_price_loaded: new EventEmitter<void>(),   // 全てのlast_priceが取得済み
      depth:            new EventEmitter<string>()  // 全ての板情報が取得済み
    },
  };
  
  // 取引情報
  public trade = {
    average_asks_on_jpy: { // JPY売り
      price: 0,
      balance: 0,        // 余り（端数による）
      history: [] // 売却量の履歴
    },
    average_asks_on_btc: { // BTC売り
      price: 0,
      balance: 0, // 余り（端数による）
      history: [],
    },
    average_bids_on_jpy: { // JPY買い
      price: 0,
      balance: 0, // 余り（端数による）
      history: [],
    },
    average_bids_on_btc: { // BTC買い
      price: 0,
      balance: 0, // 余り（端数による）
      history: [],
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
    btc_to_jpy_total_amount: 0,  // BTC買い、 JPY売り
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
    this.httpService.doHttp( 'zaif', 'currency_pairs', {}, 'Get', 'default', 'all' ).subscribe( ( currencies: ZaifCurrencyPair[] ) => {
      currencies = currencies.map( _ => new ZaifCurrencyPair( _ ) );
      this.currency_pairs.zaif.original = currencies;
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
    const value = event.value as ZaifCurrencyPair;
    this.currency_pairs.zaif.selected_pair.all = value;
    this.currency_pairs.zaif.selected_pair.name = value.currency_pair;
    this.currency_pairs.zaif.selected_pair.with_btc_name =
      this.currency_pairs.zaif.selected_pair.name.replace('_jpy', '_btc');

    // BTC / JPY の平均価格を取得last_priceを定期的に取得
    this.intervals.zaif.last_price = setInterval( () => {
      // BTCの平均価格を取得する
      this.getAverage_Btc_Jpy_Price().subscribe( _ => {
        combineLatest(
          // 板情報を取得
          this.get_SelectedPair_Jpy_Depth(),
          this.get_SelectedPair_Btc_Depth()
        ).subscribe( _ => {
          this.calc();

        } )
      } );
    }, this.intervals.zaif.interval );

  };

  public calc  = () => {
    const loaded_depth = [];

    // 板情報の表示する部分を作成（全部だと多すぎるから）
    this.makeViewPartOfDepth();

    // コイン_JPY板買いの平均価格を算出する
    this.buySelectedPairWithJpy();

    // コイン_btc板買いの平均価格を算出する
    this.buySelectedPairWithBtc();

    // コイン_btc板買いの平均価格を算出する
    this.sellSelectedPairWithJpy();

    // コイン_btc板買いの平均価格を算出する
    this.sellSelectedPairWithBtc();


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
  
  public executeArbitrage = ( type: string ) => { // jpy_to_btc or btc_to_jpy
    this.stop();
    this.interval_arbitrage_execute_message  = [];
    if ( type === 'jpy_to_btc' ) {
      this.trade.average_asks_on_jpy.history.forEach( _ => {
        this.interval_arbitrage_execute_message.push( {
          currency_pair: this.currency_pairs.zaif.selected_pair.name,
          action: 'ask',
          price: _.price,
          amount: _.amount,
          btc_price: this.btc_jpy.zaif.last_price_on_average
        } );
        this.httpService.doHttp( 'zaif', 'trade', {
          currency_pair: this.currency_pairs.zaif.selected_pair.name,
          action: 'ask',
          price: _.price,
          amount: _.amount
        }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
          console.log( trade_result );
          this.trade.average_bids_on_btc.history.forEach( _ => {
            this.interval_arbitrage_execute_message.push( {
              currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
              action: 'bid',
              price: _.price,
              amount: _.amount,
              btc_price: this.btc_jpy.zaif.last_price_on_average
            } );
            this.httpService.doHttp( 'zaif', 'trade', {
              currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
              action: 'bid',
              price: _.price,
              amount: _.amount,
            }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
              console.log( trade_result );
            }, ( error ) => {
              console.log( error );
            } );
          });
        }, ( error ) => {
          console.log( error );
        } );
      });

    } else if ( type === 'btc_to_jpy' ) {
      this.trade.average_asks_on_btc.history.forEach( _ => {
        this.interval_arbitrage_execute_message.push( {
          currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
          action: 'ask',
          price: _.price,
          amount: _.amount,
          btc_price: this.btc_jpy.zaif.last_price_on_average
        } );
        this.httpService.doHttp( 'zaif', 'trade', {
          currency_pair: this.currency_pairs.zaif.selected_pair.with_btc_name,
          action: 'ask',
          price: _.price,
          amount: _.amount
        }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
          console.log( trade_result );
          this.trade.average_bids_on_jpy.history.forEach( _ => {
            this.interval_arbitrage_execute_message.push( {
              currency_pair: this.currency_pairs.zaif.selected_pair.name,
              action: 'bid',
              price: _.price,
              amount: _.amount,
              btc_price: this.btc_jpy.zaif.last_price_on_average
            } );
            this.httpService.doHttp( 'zaif', 'trade', {
              currency_pair: this.currency_pairs.zaif.selected_pair.name,
              action: 'bid',
              price: _.price,
              amount: _.amount
            }, 'Post', 'default' ).subscribe( ( trade_result: TradeResult ) => {
              console.log( trade_result );
            }, ( error ) => {
              console.log( error );
            } );
          });
        }, ( error ) => {
          console.log( error );
        } );
      });
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

  public getAverage_Btc_Jpy_Price = (): Observable<boolean> => {
    return new Observable( ( observer ) => {
      this.httpService.doHttp( 'zaif', 'trades', {}, 'Get', 'default', 'btc_jpy' ).subscribe( ( result: any[] ) => {
          const btc_jpy_trades = result.map( _ => new ZaifTrade( _ ) );
          const now_unix_time = moment().unix();

          // n秒間の平均取引価格を取得する
          let total_amount = 0;
          let total_price = 0;
          btc_jpy_trades.forEach( _ => {
            if ( ( now_unix_time - _.date ) > this.btc_jpy.zaif.interval ) {
              return;
            }
            total_amount += _.amount;
            total_price += _.amount * _.price;
          });

          if ( total_amount !== 0 ) {
            this.btc_jpy.zaif.last_price_on_average = this.roundOnEighthDigit( total_price / total_amount );
          } else {
            // n秒前までの取引がない場合は最後の取引価格を代入する
            this.btc_jpy.zaif.last_price_on_average = btc_jpy_trades[0].price;
          }

          console.log('端数計算');
          // (取引の最小単位)5円刻みの値に調整する
          let fraction = this.btc_jpy.zaif.last_price_on_average % 5;
          fraction += fraction > 2.5 ? -5 : 0;
          this.btc_jpy.zaif.last_price_on_average -= fraction;

          // 取得の完了を通知する
          observer.next( true );
          observer.complete();
        },
        ( error: HttpErrorResponse ) => {
          clearInterval( this.intervals.zaif.last_price );
          observer.error();
          return;
        });
    });
  };

  // 選択された通過とJPYの板情報を取得
  public get_SelectedPair_Jpy_Depth = (): Observable<boolean> => {
    return new Observable( ( observer ) => {
      this.httpService.doHttp( 'zaif', 'depth', {}, 'Get',
        'default', this.currency_pairs.zaif.selected_pair.name ).subscribe( ( depth: any ) => {
        depth                                        = new ZaifDepth( depth );
        this.currency_pairs.zaif.selected_pair.depth = depth;
        // 取得の完了を通知する
        observer.next( true );
        observer.complete();
      } );
    });
  };

  public get_SelectedPair_Btc_Depth = (): Observable<boolean> => {
    return new Observable( ( observer ) => {
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

        observer.next( true );
        observer.complete();
      } );
    });
  };

  // 板情報の表示する部分を作成（全部だと多すぎるから）
  public makeViewPartOfDepth = () => {
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
  };

  // コイン_JPY板買いの平均価格を算出する
  public buySelectedPairWithJpy = () => {
    console.log( '@@@@@@@ JPY購入のセクション' );
    // まずはどこまで買えるかを調査
    let balance: number                 = this.config.amount; // 残高 ( JPY )
    const history: { amount: number, price: number }[] = [];

    for ( const key in this.currency_pairs.zaif.selected_pair.disp_depth.asks ) {
      const ask = this.currency_pairs.zaif.selected_pair.disp_depth.asks[key];
      const [price, amount] = ask;
      let bid_amount = price * amount; // 板上の売りの量をJPYに換算
      bid_amount     = this.roundOnEighthDigit( price * amount );
      if ( bid_amount >= balance ) { // 買いきった
        // 買える量を算出(端数が細かいと注文できないので)
        // 端数は切る
        // 計算誤差が出ないように1000000かける
        const valid_amount = this.roundOnEighthDigit(
          ( balance / price) - (
            ( balance / price * 1000000 ) % ( this.currency_pairs.zaif.selected_pair.all.item_unit_step * 1000000 ) / 1000000
          )
        );
        console.log( balance / price );
        console.log( ( balance / price * 1000000 ) % (this.currency_pairs.zaif.selected_pair.all.item_unit_step * 1000000) );
        console.log( ( balance / price * 1000000 ) % (this.currency_pairs.zaif.selected_pair.all.item_unit_step * 1000000) / 1000000);

        // 購入可能最小単位より小さい場合は計算終了
        if ( this.currency_pairs.zaif.selected_pair.all.item_unit_min > valid_amount ) {
          break;
        }

        history.push( { amount: valid_amount, price: price } );
        balance -= valid_amount * price;
        // 最終残高(端数)を決定。1/10000以下は無視する
        balance = Math.floor( balance );
        this.trade.average_asks_on_jpy.balance = balance;
        break;
      } else { // もっと買える
        history.push( { amount: amount, price: price } );
        balance = this.roundOnEighthDigit( balance - bid_amount );
      }
    }
    console.log(history);

    this.trade.average_asks_on_jpy.history = history;
    // 平均金額を出す
    let total_price: number  = 0;
    let total_amount: number = 0;
    history.forEach( _ => {
      total_price += _.amount * _.price;
      total_amount += _.amount;
    });

    // ^8以下の数字を落とす
    total_price  = this.roundOnEighthDigit( total_price );
    total_amount = this.roundOnEighthDigit( total_amount );
    this.internal_arbitrage_on_depth.jpy_to_btc_total_price = total_price;
    this.internal_arbitrage_on_depth.jpy_to_btc_total_amount = total_amount;
    this.trade.average_asks_on_jpy.price = this.roundOnEighthDigit( total_price / total_amount );
  };

  // コイン_btc板買いの平均価格を算出する
  buySelectedPairWithBtc = () => {
    // まずはどこまで買えるかを調査
    console.log( '@@@@@@@ BTC購入のセクション' );
    let balance = this.roundOnEighthDigit( this.config.amount / this.btc_jpy.zaif.last_price_on_average ); // 残高はBTCで計算
    const history: { amount: number, price: number }[] = [];
    const btc = this.currency_pairs.zaif.original.find( ( _: ZaifCurrencyPair ) => {
      return this.currency_pairs.zaif.selected_pair.with_btc_name === _.currency_pair;
    });
    console.log( btc );

    for ( const key in this.btc_jpy.zaif.disp_depth.asks ) {
      if ( this.btc_jpy.zaif.disp_depth.asks.hasOwnProperty( key ) ) {
        const ask = this.btc_jpy.zaif.disp_depth.asks[key];
        const [price, amount] = this.btc_jpy.zaif.disp_depth.asks[key];
        let bid_amount = price * amount; // 板上の売りの量
        bid_amount     = this.roundOnEighthDigit( price * amount );
        if ( bid_amount >= balance ) { // 買いきった
          // 買える量を算出(端数が細かいと注文できないので)
          // 計算誤差が出ないように1000000かける
          const valid_amount = this.roundOnEighthDigit(
            (balance / price ) - (
              ( balance / price * 1000000 ) % (btc.item_unit_step * 1000000 )
            ) / 1000000
          );
          // 最小単位を下回ってた場合は終了
          if ( valid_amount < btc.item_unit_min ) {
            break;
          }
          history.push( { amount: valid_amount, price: price } );
          balance -= valid_amount * price;
          // 最終残高(端数)を決定
          balance                                = this.roundOnEighthDigit( balance );
          this.trade.average_asks_on_btc.balance = balance;
          break;
        } else { // もっと買える
          history.push( { amount: amount, price: price } );
          balance = this.roundOnEighthDigit( balance - bid_amount );
        }
      }
    }

    this.trade.average_asks_on_btc.history = history;

    // 平均金額を出す
    let total_price = 0;
    let total_amount = 0;
    history.forEach( _ => {
      total_price += _.amount * _.price;
      total_amount += _.amount;
    });

    // ^8以下の数字を落とす
    total_price  = this.roundOnEighthDigit( total_price  );
    total_amount = this.roundOnEighthDigit( total_amount );
    this.internal_arbitrage_on_depth.btc_to_jpy_total_price = total_price * this.btc_jpy.zaif.last_price_on_average;
    this.internal_arbitrage_on_depth.btc_to_jpy_total_amount = total_amount;
    console.log(history);
    console.log(total_price);
    console.log(total_amount);
    this.trade.average_asks_on_btc.price = this.roundOnEighthDigit( total_price / total_amount );
  };

  // コイン_btc板買いの平均価格を算出する
  public sellSelectedPairWithJpy = () => {
    // まずはどこまで買えるかを調査
    console.log( '@@@@@@@ JPY売却のセクション' );
    // BTC購入セクションで購入した数
    let balance          = this.roundOnEighthDigit( this.internal_arbitrage_on_depth.btc_to_jpy_total_amount ); // コイン残高 )
    console.log(`balance ${balance}`);
    const history: { amount: number, price: number }[] = [];
    for ( const key in this.currency_pairs.zaif.selected_pair.disp_depth.bids ) {
      if ( this.currency_pairs.zaif.selected_pair.disp_depth.asks.hasOwnProperty( key ) ) {
        const price    = this.currency_pairs.zaif.selected_pair.disp_depth.bids[key][0];
        const amount   = this.currency_pairs.zaif.selected_pair.disp_depth.bids[key][1];
        let ask_amount = price * amount; // 板上の売りの量
        ask_amount     = this.roundOnEighthDigit( price * amount );
        if ( amount >= balance ) { // 売りきった
          // 売れる量を算出(端数が細かいと注文できないので)
          // 計算誤差が出ないように1000000かける
          const valid_amount = this.roundOnEighthDigit(
            balance - (
            ( balance * 1000000 ) % ( this.currency_pairs.zaif.selected_pair.all.item_unit_step * 1000000 ) / 1000000
            )
          );
          // 最小単位を下回る場合は終了
          if ( balance < this.currency_pairs.zaif.selected_pair.all.item_unit_min ) {
            break;
          }
          console.log(valid_amount);
          history.push( { amount: valid_amount, price: price } );
          // 最終残高(端数)を決定
          balance -= valid_amount;
          balance                                = this.roundOnEighthDigit( balance );
          this.trade.average_bids_on_jpy.balance = balance;
          break;
        } else { // もっと買える
          history.push( { amount: amount, price: price } );
          balance = this.roundOnEighthDigit( balance - amount );
        }
      }
    }

    this.trade.average_bids_on_jpy.history = history;

    // 平均金額を出す
    let total_price = 0;
    let total_amount = 0;
    history.forEach( _ => {
      total_price += _.amount * _.price;
      total_amount += _.amount;
    });
    // ^8以下の数字を落とす
    total_price  = this.roundOnEighthDigit( total_price );
    total_amount = this.roundOnEighthDigit( total_amount );
    this.trade.average_bids_on_jpy.price = this.roundOnEighthDigit( total_price / total_amount );
  };

  // コイン_btc板買いの平均価格を算出する
  public sellSelectedPairWithBtc = () => {
    // まずはどこまで買えるかを調査
    console.log( '@@@@@@@ BTC売却のセクション' );
    // 残高はJPY購入セクションで実際に購入した数
    let balance = this.roundOnEighthDigit( this.internal_arbitrage_on_depth.jpy_to_btc_total_amount ); // コイン残高
    const history: { amount: number, price: number }[] = [];
    const btc = this.currency_pairs.zaif.original.find( ( _: ZaifCurrencyPair ) => {
      return this.currency_pairs.zaif.selected_pair.with_btc_name === _.currency_pair;
    });

    for ( const key in this.btc_jpy.zaif.disp_depth.bids ) {
      if ( this.btc_jpy.zaif.disp_depth.asks.hasOwnProperty( key ) ) {
        const [price, amount] = this.btc_jpy.zaif.disp_depth.bids[key];
        let ask_amount = price * amount; // 板上の売りの量
        ask_amount     = this.roundOnEighthDigit( price * amount );
        if ( amount >= balance ) { // 売りきった
          // 買える量を算出(端数が細かいと注文できないので)
          const valid_amount = this.roundOnEighthDigit(
            balance - ( ( balance * 1000000) % btc.item_unit_step * 1000000 ) / 1000000
          );
          history.push( { amount: valid_amount, price: price } );
          // 最終残高(端数)を決定
          balance -= valid_amount;
          balance                                = this.roundOnEighthDigit( balance );
          this.trade.average_bids_on_btc.balance = balance;
          break;
        } else { // もっと買える
          history.push( { amount: amount, price: price } );
          balance = this.roundOnEighthDigit( balance - amount );
        }
      }
    }
    this.trade.average_bids_on_btc.history = history;

    // 平均金額を出す
    let total_price = 0;
    let total_amount = 0;
    history.forEach( _ => {
      total_price += _.amount * _.price;
      total_amount += _.amount;
    });

    // ^8以下の数字を落とす
    total_price  = Math.floor( (total_price) * 100000000 ) / 100000000;
    total_amount = Math.floor( ( total_amount) * 100000000 ) / 100000000;
    this.trade.average_bids_on_btc.price = this.roundOnEighthDigit( total_price / total_amount );
  };
}


