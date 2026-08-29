import { describe, expect, it } from 'vitest';
import { presentOrder, presentMyOrdersPage } from './orderPresenter';
import type { OrderViewModel, MyOrdersPageViewModel } from './order.service';

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

const SAMPLE_MY_ORDERS_PAGE: MyOrdersPageViewModel = {
  orders: [
    {
      idOrder: 12,
      idUser: 3,
      status: 'PAID',
      totalAmount: 1499.5,
      createdAt: '2026-08-20T10:00:00.000Z',
      paymentReference: 'MP-123',
    },
    {
      idOrder: 11,
      idUser: 3,
      status: 'AWAITING_PAYMENT',
      totalAmount: 200,
      createdAt: '2026-08-19T10:00:00.000Z',
      paymentReference: null,
    },
  ],
  page: 1,
  pageSize: 20,
  total: 37,
  totalPages: 2,
};

describe('presentMyOrdersPage', () => {
  it('formats one row per order, reusing formatCurrency and linking to the existing detail route', () => {
    const presentation = presentMyOrdersPage(SAMPLE_MY_ORDERS_PAGE);

    expect(presentation.rows).toHaveLength(2);
    expect(presentation.rows[0]).toEqual({
      idOrderLabel: '12',
      statusLabel: 'Estado: PAID',
      totalLabel: '1499.50',
      createdAtLabel: new Date('2026-08-20T10:00:00.000Z').toLocaleString('es-AR'),
      detailHref: '/order?id=12',
    });
    expect(presentation.rows[1].detailHref).toBe('/order?id=11');
  });

  it('flags an empty page and produces no rows when there are no orders yet', () => {
    const presentation = presentMyOrdersPage({ ...SAMPLE_MY_ORDERS_PAGE, orders: [], total: 0, totalPages: 0 });

    expect(presentation.isEmpty).toBe(true);
    expect(presentation.rows).toEqual([]);
  });

  it('computes prev/next hrefs from page/totalPages, omitting prev on page 1 and next on the last page', () => {
    const firstPage = presentMyOrdersPage(SAMPLE_MY_ORDERS_PAGE);
    expect(firstPage.prevHref).toBeNull();
    expect(firstPage.nextHref).toBe('/orders?page=2');

    const lastPage = presentMyOrdersPage({ ...SAMPLE_MY_ORDERS_PAGE, page: 2 });
    expect(lastPage.prevHref).toBe('/orders?page=1');
    expect(lastPage.nextHref).toBeNull();
  });
});
