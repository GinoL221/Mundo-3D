export interface StockShortage {
  idProduct: number;
  productName: string;
  requested: number;
  available: number;
}

export class InsufficientStockException extends Error {
  status = 409;
  statusCode = 409;
  constructor(
    public readonly shortages: StockShortage[],
    message: string = 'Insufficient stock for one or more products',
  ) {
    super(message);
    this.name = 'InsufficientStockException';
    Object.setPrototypeOf(this, InsufficientStockException.prototype);
  }
}
