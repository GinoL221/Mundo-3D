import { Order, OrderStatus } from './Order';
import { OrderItem } from './OrderItem';
import { OrderValidationException } from '../exceptions/OrderValidationException';

function buildItem(overrides: Partial<{ idOrderItem: number; idOrder: number; idProduct: number | null; productName: string; quantity: number; unitPrice: number }> = {}): OrderItem {
  return new OrderItem(
    overrides.idOrderItem ?? 1,
    overrides.idOrder ?? 1,
    overrides.idProduct ?? 1,
    overrides.productName ?? 'Maceta Groot',
    overrides.quantity ?? 1,
    overrides.unitPrice ?? 150,
  );
}

describe('Order', () => {
  it('is constructed with status AWAITING_PAYMENT and a derived totalAmount', () => {
    const item = buildItem({ quantity: 2, unitPrice: 150 });
    const order = new Order(1, 7, 'key-1', OrderStatus.AWAITING_PAYMENT, [item], new Date('2026-08-28T00:00:00Z'));

    expect(order.status).toBe(OrderStatus.AWAITING_PAYMENT);
    expect(order.totalAmount).toBe(300);
  });

  it('exposes no shipping, contact, or notes property', () => {
    const order = new Order(1, 7, 'key-1', OrderStatus.AWAITING_PAYMENT, [buildItem()], new Date());

    expect((order as unknown as Record<string, unknown>).shippingAddress).toBeUndefined();
    expect((order as unknown as Record<string, unknown>).contact).toBeUndefined();
    expect((order as unknown as Record<string, unknown>).notes).toBeUndefined();
  });

  it('rejects construction with zero items', () => {
    expect(() => new Order(1, 7, 'key-1', OrderStatus.AWAITING_PAYMENT, [], new Date())).toThrow(OrderValidationException);
  });

  it('computes totalAmount as the sum of item subtotals', () => {
    const items = [buildItem({ quantity: 2, unitPrice: 50 }), buildItem({ idOrderItem: 2, quantity: 1, unitPrice: 30 })];
    const order = new Order(1, 7, 'key-1', OrderStatus.AWAITING_PAYMENT, items, new Date());

    expect(order.totalAmount).toBe(130);
  });

  describe('legal transitions', () => {
    it('allows AWAITING_PAYMENT -> PAID', () => {
      expect(Order.canTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID)).toBe(true);
    });

    it('allows AWAITING_PAYMENT -> CANCELLED', () => {
      expect(Order.canTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED)).toBe(true);
    });

    it('rejects any transition out of PAID (terminal)', () => {
      expect(Order.canTransition(OrderStatus.PAID, OrderStatus.AWAITING_PAYMENT)).toBe(false);
      expect(Order.canTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(false);
    });

    it('rejects any transition out of CANCELLED (terminal)', () => {
      expect(Order.canTransition(OrderStatus.CANCELLED, OrderStatus.AWAITING_PAYMENT)).toBe(false);
      expect(Order.canTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
    });

    it('canTransitionTo delegates to the instance status', () => {
      const order = new Order(1, 7, 'key-1', OrderStatus.AWAITING_PAYMENT, [buildItem()], new Date());

      expect(order.canTransitionTo(OrderStatus.PAID)).toBe(true);
      expect(order.canTransitionTo(OrderStatus.CANCELLED)).toBe(true);
    });
  });
});
