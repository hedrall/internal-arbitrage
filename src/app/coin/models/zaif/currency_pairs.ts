export class ZaifCurrencyPairs {
  responce: Array<ZaifCurrencyPair>;
}

export class ZaifCurrencyPair {
  name:           string;  // "BTC/JPY"
  title:          string;  // "BTC/JPY"
  currency_pair:  string;  // "btc_jpy"
  description:    string;
  is_token:       boolean; // false
  event_number:   number;  // 0
  item_unit_min:  number;  // 0.0001
  item_unit_step: number;  // 0.0001
  aux_unit_min:   number;  // 5.0
  aux_unit_step:  number;  // 5.0
  seq:            number;  // 0
  aux_japanese:   string;  // "\u65e5\u672c\u5186",
  item_japanese:  string;  // "\u30d3\u30c3\u30c8\u30b3\u30a4\u30f3",
  aux_unit_point: number;  // 0,
}
