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
