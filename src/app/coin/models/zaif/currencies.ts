export class ZaifCurrencies {
  public response: Array<ZaifCurrency>;
}

export class ZaifCurrency {
  name:     string;  // btc
  is_token: boolean;
}
