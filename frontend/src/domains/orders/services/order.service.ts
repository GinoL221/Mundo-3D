import { API_URL, withCredentials } from '../../../config';

// Mirrors backend/src/application/dtos/OrderDTO.ts exactly (order-checkout
// spec, "Buyer order-detail response DTO") — GET /api/orders/:id returns the
// identical shape as the 201 body of POST /api/orders, so this is the one
// parser for both. `idempotencyKey` is deliberately absent (client-only
// dedup token, never buyer-facing).
export interface OrderItemViewModel {
  idOrderItem: number;
  idProduct: number | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface OrderViewModel {
  idOrder: number;
  idUser: number;
  status: string;
  items: OrderItemViewModel[];
  totalAmount: number;
  createdAt: string;
  paymentReference: string | null;
}

export type FetchOrderErrorCode = 'NOT_FOUND' | 'NETWORK' | 'UNKNOWN';

export type FetchOrderResult =
  | { ok: true; order: OrderViewModel }
  | { ok: false; code: FetchOrderErrorCode; message: string };

/**
 * `GET /api/orders/:id` — buyer's own order or ADMIN (order-checkout spec,
 * "Routes and the ADMIN guard"). The backend returns 404 both for a genuinely
 * missing order and for one the caller does not own, to avoid order-id
 * enumeration; this surfaces uniformly as NOT_FOUND.
 */
export async function fetchOrder(idOrder: number): Promise<FetchOrderResult> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/orders/${idOrder}`, withCredentials({ method: 'GET' }));
  } catch {
    return { ok: false, code: 'NETWORK', message: 'No se pudo conectar con el servidor.' };
  }

  if (res.status === 404) {
    return { ok: false, code: 'NOT_FOUND', message: 'Orden no encontrada.' };
  }

  if (!res.ok) {
    return { ok: false, code: 'UNKNOWN', message: `Error ${res.status}` };
  }

  const order = (await res.json()) as OrderViewModel;
  return { ok: true, order };
}

// Mirrors backend/src/application/dtos/OrderDTO.ts's `OrderSummaryDTO`
// exactly (order-history spec, "Buyer-Scoped Order Listing") — no `items`
// key, unlike `OrderViewModel` above.
export interface OrderSummaryViewModel {
  idOrder: number;
  idUser: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  paymentReference: string | null;
}

export interface MyOrdersPageViewModel {
  orders: OrderSummaryViewModel[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type FetchMyOrdersErrorCode = 'UNAUTHENTICATED' | 'INVALID_PAGINATION' | 'NETWORK' | 'UNKNOWN';

export type FetchMyOrdersResult =
  | { ok: true; page: MyOrdersPageViewModel }
  | { ok: false; code: FetchMyOrdersErrorCode; message: string };

/**
 * `GET /api/orders/mine` — buyer-scoped, paginated order history
 * (order-history spec). Same discriminated-union shape as `fetchOrder`
 * above: try/catch -> NETWORK, 401 -> UNAUTHENTICATED,
 * 400 -> INVALID_PAGINATION, other non-ok -> UNKNOWN.
 */
export async function fetchMyOrders(page?: number, pageSize?: number): Promise<FetchMyOrdersResult> {
  const params = new URLSearchParams();
  if (page !== undefined) params.set('page', String(page));
  if (pageSize !== undefined) params.set('pageSize', String(pageSize));
  const query = params.toString();

  let res: Response;
  try {
    res = await fetch(
      `${API_URL}/api/orders/mine${query ? `?${query}` : ''}`,
      withCredentials({ method: 'GET' }),
    );
  } catch {
    return { ok: false, code: 'NETWORK', message: 'No se pudo conectar con el servidor.' };
  }

  if (res.status === 401) {
    return { ok: false, code: 'UNAUTHENTICATED', message: 'Necesitás iniciar sesión.' };
  }

  if (res.status === 400) {
    return { ok: false, code: 'INVALID_PAGINATION', message: 'Parámetros de paginación inválidos.' };
  }

  if (!res.ok) {
    return { ok: false, code: 'UNKNOWN', message: `Error ${res.status}` };
  }

  const page_ = (await res.json()) as MyOrdersPageViewModel;
  return { ok: true, page: page_ };
}
