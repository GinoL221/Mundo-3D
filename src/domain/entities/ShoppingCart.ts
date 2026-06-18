import { CartValidationException } from '../exceptions/CartValidationException';

export enum CartStatus {
  ACTIVE = 'ACTIVE',
  ORDERED = 'ORDERED',
  ABANDONED = 'ABANDONED'
}

export class ShoppingCart {
  constructor(
    public readonly idCart: number,
    public readonly idUser: number,
    public readonly idProduct: number,
    public readonly quantity: number,
    public readonly unitPrice: number,
    public readonly status: CartStatus
  ) {
    if (!Number.isInteger(quantity)) {
      throw new CartValidationException('Quantity must be an integer');
    }
    if (quantity <= 0) {
      throw new CartValidationException('Quantity must be greater than 0');
    }
    if (quantity > 10) {
      throw new CartValidationException('Quantity cannot exceed the maximum limit of 10');
    }
  }

  hasPriceDrift(activeProductPrice: number): boolean {
    return this.unitPrice !== activeProductPrice;
  }
}

