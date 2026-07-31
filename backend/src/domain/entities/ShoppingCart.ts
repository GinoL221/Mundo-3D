import { CartValidationException } from '../exceptions/CartValidationException';
import { Product } from './Product';

export enum CartStatus {
  ACTIVE = 'ACTIVE',
  ORDERED = 'ORDERED',
  ABANDONED = 'ABANDONED'
}

export const MAX_CART_ITEM_QUANTITY = 99;

export class ShoppingCart {
  static assertValidQuantity(quantity: number): void {
    if (!Number.isInteger(quantity)) {
      throw new CartValidationException('Quantity must be an integer');
    }
    if (quantity <= 0) {
      throw new CartValidationException('Quantity must be greater than 0');
    }
    if (quantity > MAX_CART_ITEM_QUANTITY) {
      throw new CartValidationException(`Quantity cannot exceed the maximum limit of ${MAX_CART_ITEM_QUANTITY}`);
    }
  }

  constructor(
    public readonly idCart: number,
    public readonly idUser: number,
    public readonly idProduct: number,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly status: CartStatus,
    public readonly product?: Product
  ) {
    ShoppingCart.assertValidQuantity(quantity);
  }

  hasPriceDrift(activeProductPrice: number): boolean {
    return this.unitPrice !== activeProductPrice;
  }

}

