export class TradeResult {
  success: number;
  return: {
    received: number, // 今回の注文で約定した取引量
    remains: number, // 今回の注文で約定せず、板に残った取引量
    order_id: 0,
    funds: {} // 残高
  }
}

export class ZaifTrade {
  date: number; // 1550931908,
  price: number; // 434645,
  amount: number; // 0.109,
  tid: number; // 137967855,
  currency_pair: string; // "btc_jpy",
  trade_type: 'ask'|'bid'; // "ask",

  constructor ( _: Partial<ZaifTrade> ) {
    Object.assign( this, _ );
  }
}
