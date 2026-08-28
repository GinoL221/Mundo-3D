import { OrderValidationException } from '../exceptions/OrderValidationException';
import { OrderItem } from './OrderItem';

export enum OrderStatus {
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

const LEGAL_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [],
  [OrderStatus.CANCELLED]: [],
};

export class Order {
  constructor(
    public readonly idOrder: number,
    public readonly idUser: number,
    public readonly idempotencyKey: string,
    public readonly status: OrderStatus,
    public readonly items: OrderItem[],
    public readonly createdAt: Date,
    public readonly paymentReference: string | null = null,
  ) {
    if (items.length === 0) {
      throw new OrderValidationException('An order must contain at least one item');
    }
  }

  get totalAmount(): number {
    return this.items.reduce((sum, item) => sum + item.subtotal, 0);
  }

  static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return LEGAL_TRANSITIONS[from].includes(to);
  }

  canTransitionTo(next: OrderStatus): boolean {
    return Order.canTransition(this.status, next);
  }
}
