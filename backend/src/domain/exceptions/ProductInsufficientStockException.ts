export class ProductInsufficientStockException extends Error {
  constructor(message: string = 'Insufficient stock') {
    super(message);
    this.name = 'ProductInsufficientStockException';
    Object.setPrototypeOf(this, ProductInsufficientStockException.prototype);
  }
}
