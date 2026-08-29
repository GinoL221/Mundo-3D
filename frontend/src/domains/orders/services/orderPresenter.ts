import type { OrderViewModel, MyOrdersPageViewModel } from './order.service';

// Pure formatting layer between the fetched OrderViewModel and
// OrderDetail.astro's DOM-writing script. Extracted so the actual rendering
// LOGIC (labels, currency/date formatting, item-row shaping) is testable
// without an Astro component-rendering harness (none exists in this repo —
// see checkout.test.ts/CartService.test.ts precedent of testing extracted
// pure logic instead of DOM wiring).
export interface OrderItemRow {
  productName: string;
  quantityLabel: string;
  unitPriceLabel: string;
  subtotalLabel: string;
}

export interface OrderPresentation {
  idOrderLabel: string;
  statusLabel: string;
  createdAtLabel: string;
  paymentReferenceLabel: string;
  totalLabel: string;
  items: OrderItemRow[];
}

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

export function presentOrder(order: OrderViewModel): OrderPresentation {
  return {
    idOrderLabel: String(order.idOrder),
    statusLabel: `Estado: ${order.status}`,
    createdAtLabel: `Fecha: ${new Date(order.createdAt).toLocaleString('es-AR')}`,
    paymentReferenceLabel: order.paymentReference
      ? `Referencia de pago: ${order.paymentReference}`
      : '',
    totalLabel: formatCurrency(order.totalAmount),
    items: order.items.map((item) => ({
      productName: item.productName,
      quantityLabel: String(item.quantity),
      unitPriceLabel: `$ ${formatCurrency(item.unitPrice)}`,
      subtotalLabel: `$ ${formatCurrency(item.subtotal)}`,
    })),
  };
}

// Order-history list rows — pure formatting layer for OrderList.astro,
// mirroring presentOrder's rationale above. Reuses the same private
// formatCurrency helper.
export interface OrderSummaryRow {
  idOrderLabel: string;
  statusLabel: string;
  totalLabel: string;
  createdAtLabel: string;
  detailHref: string;
}

export interface MyOrdersPresentation {
  rows: OrderSummaryRow[];
  isEmpty: boolean;
  pageLabel: string;
  prevHref: string | null;
  nextHref: string | null;
}

export function presentMyOrdersPage(page: MyOrdersPageViewModel): MyOrdersPresentation {
  return {
    rows: page.orders.map((order) => ({
      idOrderLabel: String(order.idOrder),
      statusLabel: `Estado: ${order.status}`,
      totalLabel: formatCurrency(order.totalAmount),
      createdAtLabel: new Date(order.createdAt).toLocaleString('es-AR'),
      detailHref: `/order?id=${order.idOrder}`,
    })),
    isEmpty: page.orders.length === 0,
    pageLabel: `Página ${page.page} de ${Math.max(page.totalPages, 1)}`,
    prevHref: page.page > 1 ? `/orders?page=${page.page - 1}` : null,
    nextHref: page.page < page.totalPages ? `/orders?page=${page.page + 1}` : null,
  };
}
