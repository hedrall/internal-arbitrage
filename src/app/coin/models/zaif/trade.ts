export class TradeResult{
  success: number;
  return: {
    received: number, // 今回の注文で約定した取引量
    remains: number, // 今回の注文で約定せず、板に残った取引量
    order_id: 0,
    funds: {} // 残高
  }
}
