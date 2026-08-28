import { describe, expect, it } from 'vitest';
import { presentOrder } from './orderPresenter';
import type { OrderViewModel } from './order.service';

// Sample DTO taken verbatim from design.md's "Buyer order-detail response
// DTO" section — this is the smoke-test target OrderDetail.astro's script
// consumes for every rendered field (see orderPresenter.ts module doc for
// why the assertion targets this extracted pure function rather than an
// Astro-rendered DOM tree: no Astro component-render test harness exists in
// this repo).
const SAMPLE_ORDER: OrderViewModel = {
  idOrder: 41,
  idUser: 7,
  status: 'AWAITING_PAYMENT',
  items: [
    { idOrderItem: 88, idProduct: 12, productName: 'Maceta Groot', quantity: 2, unitPrice: 1500.0, subtotal: 3000.0 },
  ],
  totalAmount: 3000.0,
  createdAt: '2026-08-28T14:03:11.000Z',
  paymentReference: 'MANUAL-41-9f2c1a',
};

describe('presentOrder', () => {
  it('formats every buyer-facing field from the sample order DTO', () => {
    const presentation = presentOrder(SAMPLE_ORDER);

    expect(presentation.idOrderLabel).toBe('41');
    expect(presentation.statusLabel).toBe('Estado: AWAITING_PAYMENT');
    expect(presentation.paymentReferenceLabel).toBe('Referencia de pago: MANUAL-41-9f2c1a');
    expect(presentation.totalLabel).toBe('3000.00');
    expect(presentation.items).toEqual([
      {
        productName: 'Maceta Groot',
        quantityLabel: '2',
        unitPriceLabel: '$ 1500.00',
        subtotalLabel: '$ 3000.00',
      },
    ]);
  });

  it('renders an empty payment-reference label when the order has none yet', () => {
    const presentation = presentOrder({ ...SAMPLE_ORDER, paymentReference: null });

    expect(presentation.paymentReferenceLabel).toBe('');
  });

  it('shapes one row per order item, preserving order', () => {
    const twoItemOrder: OrderViewModel = {
      ...SAMPLE_ORDER,
      items: [
        { idOrderItem: 1, idProduct: 1, productName: 'A', quantity: 1, unitPrice: 10, subtotal: 10 },
        { idOrderItem: 2, idProduct: null, productName: 'B (producto eliminado)', quantity: 3, unitPrice: 5, subtotal: 15 },
      ],
    };

    const presentation = presentOrder(twoItemOrder);

    expect(presentation.items).toHaveLength(2);
    expect(presentation.items[1]).toEqual({
      productName: 'B (producto eliminado)',
      quantityLabel: '3',
      unitPriceLabel: '$ 5.00',
      subtotalLabel: '$ 15.00',
    });
  });
});
