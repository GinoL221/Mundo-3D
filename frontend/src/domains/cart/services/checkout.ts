import { API_URL, getSessionUser, withCredentials } from '../../../config';
import { cartItems, persistCart } from './cartState';
import { discardPendingSync, flushCartSync } from './cartSync';

export type CheckoutErrorCode =
  | 'UNAUTHENTICATED'
  | 'EMPTY_CART'
  | 'INSUFFICIENT_STOCK'
  | 'NETWORK'
  | 'UNKNOWN';

export interface StockShortage {
  idProduct: number;
  productName: string;
  requested: number;
  available: number;
}

export type CheckoutResult =
  | { ok: true; idOrder: number; totalAmount: number }
  | { ok: false; code: CheckoutErrorCode; message: string; shortages?: StockShortage[] };

interface OrderApiErrorBody {
  error?: string;
  code?: string;
  shortages?: StockShortage[];
}

interface OrderApiSuccessBody {
  idOrder: number;
  totalAmount: number;
}

// Client-supplied dedup token (order-checkout spec, "Idempotency Key on
// Checkout"). Cached at module scope so a NETWORK-failure retry of the SAME
// checkout attempt reuses the SAME key — that is the entire point of the
// header, letting the server replay the original committed order instead of
// decrementing stock twice. Cleared on success and on any definitive 4xx
// rejection, so a genuinely NEW checkout attempt gets a fresh key.
let pendingCheckoutKey: string | null = null;

const KNOWN_ERROR_CODES: readonly CheckoutErrorCode[] = ['EMPTY_CART', 'INSUFFICIENT_STOCK'];

function toCheckoutErrorCode(code: string | undefined): CheckoutErrorCode {
  return (KNOWN_ERROR_CODES as readonly string[]).includes(code ?? '')
    ? (code as CheckoutErrorCode)
    : 'UNKNOWN';
}

/**
 * `POST /api/orders` — the real checkout call, replacing the previous fake
 * destroy-and-return-`true` implementation (design.md "CartService.checkout()
 * becomes genuinely async"). Fixes two pre-existing bugs: (1) the server's
 * `ACTIVE` cart is now guaranteed in sync before the order is built, because
 * `flushCartSync()` is awaited instead of fired-and-forgotten; (2) the local
 * cart is only cleared AFTER a genuine 201, never optimistically — an
 * all-or-nothing stock rejection leaves the buyer's visible cart untouched.
 */
export async function checkout(): Promise<CheckoutResult> {
  if (!getSessionUser()) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'Debe iniciar sesión para finalizar la compra.',
    };
  }

  // Correctness fix: today's checkout never awaits this, so the server's
  // ACTIVE cart can lag what the buyer sees on screen when the order is built.
  await flushCartSync();

  if (pendingCheckoutKey === null) {
    pendingCheckoutKey = crypto.randomUUID();
  }
  const idempotencyKey = pendingCheckoutKey;

  let res: Response;
  try {
    res = await fetch(
      `${API_URL}/api/orders`,
      withCredentials({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: '{}',
      })
    );
  } catch {
    // fetch() itself threw: an ambiguous/genuine network failure. Keep the
    // cached key so a retry of THIS SAME attempt reuses it; the local cart
    // is left untouched (no side effect happened on the server either).
    return {
      ok: false,
      code: 'NETWORK',
      message: 'No se pudo conectar con el servidor. Intente nuevamente.',
    };
  }

  if (res.ok) {
    pendingCheckoutKey = null;
    const body = (await res.json()) as OrderApiSuccessBody;
    // Clear locally WITHOUT scheduling a background sync: the server already
    // flipped the cart rows to ORDERED, so a redundant PUT /api/cart [] would
    // race the transaction that just committed.
    cartItems.set([]);
    persistCart([]);
    discardPendingSync();
    return { ok: true, idOrder: body.idOrder, totalAmount: body.totalAmount };
  }

  // A definitive answer from the server (4xx) — not ambiguous like a thrown
  // fetch. Clear the cached key so a genuinely NEW checkout attempt gets a
  // fresh one next time. The local cart is deliberately left untouched: the
  // order was rejected, nothing was committed server-side.
  pendingCheckoutKey = null;

  let body: OrderApiErrorBody = {};
  try {
    body = (await res.json()) as OrderApiErrorBody;
  } catch {
    // No/malformed body — fall through to the UNKNOWN default below.
  }

  return {
    ok: false,
    code: toCheckoutErrorCode(body.code),
    message: body.error ?? `Error ${res.status}`,
    shortages: body.shortages,
  };
}
