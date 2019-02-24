export class ZaifDepth {
  asks: number[][];
  bids: number[][];

  constructor ( _: Partial<ZaifDepth> ) {
    Object.assign( this, _ );
  }
}

export class ZaifDepthAsk {

}
