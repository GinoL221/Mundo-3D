import { CartValidationException } from '../exceptions/CartValidationException';
import { Product } from './Product';

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
    public readonly status: CartStatus,
    public readonly product?: Product
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

  /** @deprecated Use `idCart` instead. */
  get IDCart(): number {
    return this.idCart;
  }

  /** @deprecated Use `idUser` instead. */
  get IDUser(): number {
    return this.idUser;
  }

  /** @deprecated Use `idProduct` instead. */
  get IDProduct(): number {
    return this.idProduct;
  }

  /** @deprecated Use `quantity` instead. */
  get Quantity(): number {
    return this.quantity;
  }

  /** @deprecated Use `unitPrice` instead. */
  get UnitPrice(): number {
    return this.unitPrice;
  }

  /** @deprecated Use `status` instead. */
  get CartStatus(): string {
    return this.status;
  }
}

