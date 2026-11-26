import type {
  MyOrdersPageViewModel,
  OrderViewModel,
  WorkshopOrderViewModel,
} from './order.service';

// Pure formatting layer between the fetched OrderViewModel and
// OrderDetail.astro / OrderList.astro DOM scripts. Keeps business/presentation
// logic testable without an Astro component-rendering harness and accepts the
// shared es-AR price formatter via DI so `frontend.domain.locality` stays clean.
export type AmountFormatter = (amount: number) => string;

const fallbackPriceFormatter = new Intl.NumberFormat('es-AR');
const defaultFormatAmount: AmountFormatter = (amount) => `$ ${fallbackPriceFormatter.format(amount)}`;

const ORDER_STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: 'Pedido simulado',
  PAID: 'Confirmado (demo)',
  CANCELLED: 'Cancelado',
};

const UNKNOWN_STATUS_LABEL = 'Pedido registrado';

export function formatOrderStatus(status: string): string {
  return ORDER_STATUS_LABELS[status] ?? UNKNOWN_STATUS_LABEL;
}

export interface OrderItemRow {
  productName: string;
  productHref: string | null;
  quantityLabel: string;
  unitPriceLabel: string;
  subtotalLabel: string;
}

export interface OrderPresentation {
  idOrderLabel: string;
  statusLabel: string;
  createdAtLabel: string;
  totalLabel: string;
  items: OrderItemRow[];
}

export function presentOrder(
  order: OrderViewModel,
  formatAmount: AmountFormatter = defaultFormatAmount,
): OrderPresentation {
  return {
    idOrderLabel: String(order.idOrder),
    statusLabel: formatOrderStatus(order.status),
    createdAtLabel: `Fecha: ${new Date(order.createdAt).toLocaleString('es-AR')}`,
    totalLabel: formatAmount(order.totalAmount),
    items: order.items.map((item) => ({
      productName: item.productName,
      productHref: item.idProduct !== null ? `/product?id=${item.idProduct}` : null,
      quantityLabel: String(item.quantity),
      unitPriceLabel: formatAmount(item.unitPrice),
      subtotalLabel: formatAmount(item.subtotal),
    })),
  };
}

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

export function presentMyOrdersPage(
  page: MyOrdersPageViewModel,
  formatAmount: AmountFormatter = defaultFormatAmount,
): MyOrdersPresentation {
  return {
    rows: page.orders.map((order) => ({
      idOrderLabel: `#${order.idOrder}`,
      statusLabel: formatOrderStatus(order.status),
      totalLabel: formatAmount(order.totalAmount),
      createdAtLabel: new Date(order.createdAt).toLocaleString('es-AR'),
      detailHref: `/order?id=${order.idOrder}`,
    })),
    isEmpty: page.orders.length === 0,
    pageLabel: `Página ${page.page} de ${Math.max(page.totalPages, 1)}`,
    prevHref: page.page > 1 ? `/orders?page=${page.page - 1}` : null,
    nextHref: page.page < page.totalPages ? `/orders?page=${page.page + 1}` : null,
  };
}

export type WorkshopOrderBadgeClass =
  | 'ui-badge--warning'
  | 'ui-badge--success'
  | 'ui-badge--danger'
  | 'ui-badge--user';

export interface WorkshopOrderRow {
  idOrder: number;
  idOrderLabel: string;
  createdAtLabel: string;
  customerLabel: string;
  status: string;
  statusLabel: string;
  statusBadgeClass: WorkshopOrderBadgeClass;
  canMutate: boolean;
  itemsCountLabel: string;
  totalLabel: string;
  items: OrderItemRow[];
}

function getOrderStatusBadgeClass(status: string): WorkshopOrderBadgeClass {
  if (status === 'AWAITING_PAYMENT') return 'ui-badge--warning';
  if (status === 'PAID') return 'ui-badge--success';
  if (status === 'CANCELLED') return 'ui-badge--danger';
  return 'ui-badge--user';
}

export function presentWorkshopOrders(
  orders: readonly WorkshopOrderViewModel[],
  formatAmount: AmountFormatter = defaultFormatAmount,
): WorkshopOrderRow[] {
  return orders.map((order) => {
    const totalUnits = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const itemsCountLabel = totalUnits === 1 ? '1 pieza' : `${totalUnits} piezas`;
    const customerName = order.customer?.displayName?.trim() || 'Cliente';
    const customerId = order.customer?.idUser ?? order.idUser;
    return {
      idOrder: order.idOrder,
      idOrderLabel: `#${order.idOrder}`,
      createdAtLabel: new Date(order.createdAt).toLocaleString('es-AR'),
      customerLabel: `${customerName} · #${customerId}`,
      status: order.status,
      statusLabel: formatOrderStatus(order.status),
      statusBadgeClass: getOrderStatusBadgeClass(order.status),
      canMutate: order.status === 'AWAITING_PAYMENT',
      itemsCountLabel,
      totalLabel: formatAmount(order.totalAmount),
      items: order.items.map((item) => ({
        productName: item.productName,
        productHref: item.idProduct !== null ? `/product?id=${item.idProduct}` : null,
        quantityLabel: String(item.quantity),
        unitPriceLabel: formatAmount(item.unitPrice),
        subtotalLabel: formatAmount(item.subtotal),
      })),
    };
  });
}
