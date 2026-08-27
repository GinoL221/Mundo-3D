import { API_URL, getSessionUser, withCredentials } from '../../../config';
import { cartItems, persistCart, type CartItem } from './cartState';
import { flushCartSync, hasPendingSync, scheduleSync } from './cartSync';

// The frontend cannot import from backend/; this mirrors backend
// ShoppingCartDTO / GetCartResult and is kept in sync by hand.
export interface ServerCartItemDTO {
  idProduct: number;
  quantity: number;
  unitPrice: number;
  product: { idProduct: number; nameProduct: string; price: number; image: string | null };
}

export interface ServerCartResponse {
  items: ServerCartItemDTO[];
  total: number;
}

export const MAX_ITEM_QUANTITY = 99;

export interface PriceDrift {
  name: string;
  oldPrice: number;
  newPrice: number;
}

export interface HydrationResult {
  ok: boolean; // false ⇒ local state was NOT touched
  items: CartItem[]; // state now in the store (or the untouched local state)
  priceDrifts: PriceDrift[]; // [] unless ok
  syncScheduled: boolean; // true only when a merge PUT was issued
  reason?: 'guest' | 'network' | 'http' | 'superseded';
}

// Maps a GET /api/cart DTO entry to the local CartItem shape. unitPrice comes
// from the current product price (product.price), never the cart row's own
// stored unitPrice — that row-level value only reflects what the price was
// when the item was added server-side, not what the item is worth now.
export function mapServerCart(dtos: ServerCartItemDTO[]): CartItem[] {
  return dtos.map((dto) => ({
    productId: dto.idProduct,
    name: dto.product.nameProduct,
    image: dto.product.image ?? '',
    unitPrice: dto.product.price,
    quantity: dto.quantity,
  }));
}

// Unions a local (guest) cart with the server's cart by productId. Overlap
// sums quantities; server wins on name/image/unitPrice for overlapping items
// (the server is authority and re-prices at sync anyway — drift is reported,
// not resisted). Every merged item is clamped to MAX_ITEM_QUANTITY, not only
// summed ones, because addToCart has no client-side cap today and a
// local-only item can already exceed it. Items left non-finite or below 1
// after clamping are dropped, since the backend validator 400s the WHOLE
// PUT on an out-of-bounds quantity — one corrupt entry must not veto the
// rest of the merge. Output order is deterministic: server items in server
// order, then local-only items appended in their original local order.
export function mergeCartItems(local: CartItem[], server: CartItem[]): CartItem[] {
  const remainingLocalByProduct = new Map(local.map((item) => [item.productId, item]));
  const merged: CartItem[] = [];

  for (const serverItem of server) {
    const localItem = remainingLocalByProduct.get(serverItem.productId);
    if (localItem) {
      merged.push({ ...serverItem, quantity: localItem.quantity + serverItem.quantity });
      remainingLocalByProduct.delete(serverItem.productId);
    } else {
      merged.push({ ...serverItem });
    }
  }

  for (const localOnlyItem of remainingLocalByProduct.values()) {
    merged.push({ ...localOnlyItem });
  }

  return merged
    .map((item) => ({ ...item, quantity: Math.min(MAX_ITEM_QUANTITY, item.quantity) }))
    .filter((item) => Number.isFinite(item.quantity) && item.quantity >= 1);
}

// Compares the price the user last saw locally against the server's current
// price, for products present in both sets only — a server-only item has no
// locally-known price to have drifted from. Deliberately ignores the DTO's
// own `hasPriceDrift` field: that field compares the cart row's stored price
// against the current product price (a different, server-internal
// comparand), not what the user actually saw client-side.
export function detectPriceDrift(local: CartItem[], server: CartItem[]): PriceDrift[] {
  const localByProduct = new Map(local.map((item) => [item.productId, item]));
  const drifts: PriceDrift[] = [];

  for (const serverItem of server) {
    const localItem = localByProduct.get(serverItem.productId);
    if (localItem && localItem.unitPrice !== serverItem.unitPrice) {
      drifts.push({
        name: serverItem.name,
        oldPrice: localItem.unitPrice,
        newPrice: serverItem.unitPrice,
      });
    }
  }

  return drifts;
}

// Reconciles local cart state against GET /api/cart. Never rejects and never
// writes local state on any failure path — the whole body sits in one
// try/catch so the returned promise always resolves, and every early return
// happens before the terminal store write. Both modes flush any pending
// debounce burst before the GET so a just-made local edit reaches the server
// before we read it back (checkout's own scheduleSync+flushCartSync pattern
// is reused, never bypassed, for the merge write itself).
export async function hydrateFromServer(options?: { mergeLocal?: boolean }): Promise<HydrationResult> {
  // Read at call time, before any await — this is the guest/pre-hydration
  // snapshot used for the merge/shouldMerge decision and for drift
  // detection, per design's "mode is an explicit flag" decision.
  const initialLocal = cartItems.get();

  try {
    if (!getSessionUser()) {
      return { ok: false, items: initialLocal, priceDrifts: [], syncScheduled: false, reason: 'guest' };
    }

    flushCartSync();

    let res: Response;
    try {
      res = await fetch(`${API_URL}/api/cart`, withCredentials({ method: 'GET' }));
    } catch {
      return { ok: false, items: cartItems.get(), priceDrifts: [], syncScheduled: false, reason: 'network' };
    }

    if (!res.ok) {
      return { ok: false, items: cartItems.get(), priceDrifts: [], syncScheduled: false, reason: 'http' };
    }

    let server: CartItem[];
    try {
      const body = (await res.json()) as ServerCartResponse;
      if (!Array.isArray(body.items)) throw new Error('malformed cart response: items is not an array');
      server = mapServerCart(body.items);
    } catch {
      return { ok: false, items: cartItems.get(), priceDrifts: [], syncScheduled: false, reason: 'http' };
    }

    const shouldMerge = options?.mergeLocal === true && initialLocal.length > 0;

    if (!shouldMerge) {
      // A burst that opened DURING the GET (after our own pre-flush above)
      // means the user mutated the cart while we were mid-flight; adopting
      // the older server snapshot now would visibly undo their click.
      if (hasPendingSync()) {
        return {
          ok: false,
          items: cartItems.get(),
          priceDrifts: [],
          syncScheduled: false,
          reason: 'superseded',
        };
      }

      const priceDrifts = detectPriceDrift(initialLocal, server);
      cartItems.set(server);
      persistCart(server);
      return { ok: true, items: server, priceDrifts, syncScheduled: false };
    }

    const merged = mergeCartItems(initialLocal, server);
    cartItems.set(merged);
    persistCart(merged);
    // Never call syncToBackend() directly — scheduleSync + flushCartSync is
    // checkout()'s proven pattern: it coalesces into the merge PUT whatever
    // burst opened during the GET (rollback baseline: the server snapshot;
    // an already-open mid-flight burst keeps ITS OWN older baseline).
    scheduleSync(merged, server);
    flushCartSync();
    return { ok: true, items: merged, priceDrifts: [], syncScheduled: true };
  } catch {
    return { ok: false, items: cartItems.get(), priceDrifts: [], syncScheduled: false, reason: 'network' };
  }
}
