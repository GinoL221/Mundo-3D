import { OrderItem } from './OrderItem';
import { OrderValidationException } from '../exceptions/OrderValidationException';

describe('OrderItem', () => {
  it('rejects a zero quantity', () => {
    expect(() => new OrderItem(1, 1, 1, 'Maceta Groot', 0, 150)).toThrow(OrderValidationException);
  });

  it('rejects a negative quantity', () => {
    expect(() => new OrderItem(1, 1, 1, 'Maceta Groot', -1, 150)).toThrow(OrderValidationException);
  });

  it('rejects a non-integer quantity', () => {
    expect(() => new OrderItem(1, 1, 1, 'Maceta Groot', 1.5, 150)).toThrow(OrderValidationException);
  });

  it('rejects a negative unitPrice', () => {
    expect(() => new OrderItem(1, 1, 1, 'Maceta Groot', 1, -1)).toThrow(OrderValidationException);
  });

  it('accepts a zero unitPrice', () => {
    expect(() => new OrderItem(1, 1, 1, 'Maceta Groot', 1, 0)).not.toThrow();
  });

  it('accepts a null idProduct (product deleted, FK SET NULL)', () => {
    const item = new OrderItem(1, 1, null, 'Maceta Groot', 1, 150);

    expect(item.idProduct).toBeNull();
  });

  it('computes subtotal as quantity * unitPrice', () => {
    const item = new OrderItem(1, 1, 1, 'Maceta Groot', 3, 150);

    expect(item.subtotal).toBe(450);
  });
});
