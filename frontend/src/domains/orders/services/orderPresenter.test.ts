import { describe, expect, it } from 'vitest';
import { formatPrice } from '../../../lib/format/price';
import { formatOrderStatus, presentMyOrdersPage, presentOrder } from './orderPresenter';
import type { MyOrdersPageViewModel, OrderViewModel } from './order.service';

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

describe('formatOrderStatus', () => {
  it('maps known backend order statuses to honest neutral Spanish labels', () => {
    expect(formatOrderStatus('AWAITING_PAYMENT')).toBe('Pedido simulado');
    expect(formatOrderStatus('PAID')).toBe('Confirmado (demo)');
    expect(formatOrderStatus('CANCELLED')).toBe('Cancelado');
  });

  it('falls back to a neutral label for unknown statuses without leaking raw enums', () => {
    const label = formatOrderStatus('SOME_FUTURE_ENUM');
    expect(label).toBe('Pedido registrado');
    expect(label).not.toContain('SOME_FUTURE_ENUM');
  });
});

describe('presentOrder', () => {
  it('formats buyer-facing fields using es-AR currency, neutral status, and item product links without payment reference', () => {
    const presentation = presentOrder(SAMPLE_ORDER, formatPrice);

    expect(presentation.idOrderLabel).toBe('41');
    expect(presentation.statusLabel).toBe('Pedido simulado');
    expect(presentation).not.toHaveProperty('paymentReferenceLabel');
    expect(presentation.totalLabel).toBe('$ 3.000');
    expect(presentation.items).toEqual([
      {
        productName: 'Maceta Groot',
        productHref: '/product?id=12',
        quantityLabel: '2',
        unitPriceLabel: '$ 1.500',
        subtotalLabel: '$ 3.000',
      },
    ]);
  });

  it('omits the product link when idProduct is null (deleted product)', () => {
    const twoItemOrder: OrderViewModel = {
      ...SAMPLE_ORDER,
      items: [
        { idOrderItem: 1, idProduct: 1, productName: 'A', quantity: 1, unitPrice: 10, subtotal: 10 },
        {
          idOrderItem: 2,
          idProduct: null,
          productName: 'B (pieza eliminada)',
          quantity: 3,
          unitPrice: 5,
          subtotal: 15,
        },
      ],
    };

    const presentation = presentOrder(twoItemOrder, formatPrice);

    expect(presentation.items).toHaveLength(2);
    expect(presentation.items[0].productHref).toBe('/product?id=1');
    expect(presentation.items[1]).toEqual({
      productName: 'B (pieza eliminada)',
      productHref: null,
      quantityLabel: '3',
      unitPriceLabel: '$ 5',
      subtotalLabel: '$ 15',
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
      totalAmount: 3800,
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
  it('formats one row per order with neutral status labels, es-AR currency, and detail hrefs', () => {
    const presentation = presentMyOrdersPage(SAMPLE_MY_ORDERS_PAGE, formatPrice);

    expect(presentation.rows).toHaveLength(2);
    expect(presentation.rows[0]).toEqual({
      idOrderLabel: '#12',
      statusLabel: 'Confirmado (demo)',
      totalLabel: '$ 1.499,5',
      createdAtLabel: new Date('2026-08-20T10:00:00.000Z').toLocaleString('es-AR'),
      detailHref: '/order?id=12',
    });
    expect(presentation.rows[1].statusLabel).toBe('Pedido simulado');
    expect(presentation.rows[1].totalLabel).toBe('$ 3.800');
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
