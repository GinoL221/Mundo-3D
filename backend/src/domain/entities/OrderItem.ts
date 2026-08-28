import { OrderValidationException } from '../exceptions/OrderValidationException';

export class OrderItem {
  constructor(
    public readonly idOrderItem: number,
    public readonly idOrder: number,
    public readonly idProduct: number | null, // null once the product row is deleted (FK SET NULL)
    public readonly productName: string, // snapshot, survives product deletion
    public readonly quantity: number,
    public readonly unitPrice: number, // frozen from ShoppingCart.unit_price
  ) {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new OrderValidationException('Quantity must be an integer greater than 0');
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new OrderValidationException('Unit price must be a non-negative number');
    }
  }

  get subtotal(): number {
    return this.quantity * this.unitPrice;
  }
}
