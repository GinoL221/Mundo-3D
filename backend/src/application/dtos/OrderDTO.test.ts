import { Order, OrderStatus } from '../../domain/entities/Order';
import { OrderItem } from '../../domain/entities/OrderItem';
import { mapToOrderDTO, mapToOrderSummaryDTO } from './OrderDTO';

describe('mapToOrderDTO', () => {
  it('produces the exact buyer-facing response shape', () => {
    const item = new OrderItem(88, 41, 12, 'Maceta Groot', 2, 1500);
    const order = new Order(
      41,
      7,
      'idem-key-should-not-leak',
      OrderStatus.AWAITING_PAYMENT,
      [item],
      new Date('2026-08-28T14:03:11.000Z'),
      'MANUAL-41-9f2c1a',
    );

    const dto = mapToOrderDTO(order);

    expect(dto).toEqual({
      idOrder: 41,
      idUser: 7,
      status: 'AWAITING_PAYMENT',
      items: [
        {
          idOrderItem: 88,
          idProduct: 12,
          productName: 'Maceta Groot',
          quantity: 2,
          unitPrice: 1500,
          subtotal: 3000,
        },
      ],
      totalAmount: 3000,
      createdAt: '2026-08-28T14:03:11.000Z',
      paymentReference: 'MANUAL-41-9f2c1a',
    });
  });

  it('does not leak idempotencyKey onto the DTO', () => {
    const order = new Order(1, 7, 'secret-key', OrderStatus.AWAITING_PAYMENT, [new OrderItem(1, 1, 1, 'X', 1, 10)], new Date());

    const dto = mapToOrderDTO(order);

    expect((dto as unknown as Record<string, unknown>).idempotencyKey).toBeUndefined();
  });

  it('reports a null idProduct for a line item whose product was deleted', () => {
    const order = new Order(1, 7, 'key', OrderStatus.AWAITING_PAYMENT, [new OrderItem(1, 1, null, 'Maceta Groot', 1, 10)], new Date());

    const dto = mapToOrderDTO(order);

    expect(dto.items[0].idProduct).toBeNull();
  });
});

describe('mapToOrderSummaryDTO', () => {
  it('returns only scalar fields, with no items key at all (order-history spec)', () => {
    const item = new OrderItem(88, 41, 12, 'Maceta Groot', 2, 1500);
    const order = new Order(
      41,
      7,
      'idem-key-should-not-leak',
      OrderStatus.AWAITING_PAYMENT,
      [item],
      new Date('2026-08-28T14:03:11.000Z'),
      'MANUAL-41-9f2c1a',
    );

    const dto = mapToOrderSummaryDTO(order);

    expect(dto).toEqual({
      idOrder: 41,
      idUser: 7,
      status: 'AWAITING_PAYMENT',
      totalAmount: 3000,
      createdAt: '2026-08-28T14:03:11.000Z',
      paymentReference: 'MANUAL-41-9f2c1a',
    });
    expect((dto as unknown as Record<string, unknown>).items).toBeUndefined();
  });
});
