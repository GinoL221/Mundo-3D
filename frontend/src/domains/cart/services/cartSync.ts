import { API_URL, getSessionUser, withCredentials } from '../../../config';
import { cartItems, persistCart, type CartItem } from './cartState';

// Monotonic sequence guard: syncToBackend calls are fire-and-forget with no
// sequencing between them, so responses can arrive out of order (e.g. an
// older call's PUT resolves AFTER a newer call's PUT already succeeded and
// updated the store). Each call captures its own sequence number at call
// time; if a newer sync has already started by the time this call's
// response comes back, this call's failure is stale and must not roll back
// state that a newer, already-confirmed sync established.
let syncSeq = 0;

// Background sync to backend API.
// `previousItems` must reflect the cart state BEFORE the optimistic local
// update, so that a failed sync can roll back to a known-good state.
export async function syncToBackend(items: CartItem[], previousItems: CartItem[]): Promise<void> {
  const sessionUser = getSessionUser();
  if (!sessionUser) return; // Not authenticated — skip sync

  const mySeq = ++syncSeq;

  try {
    const payload = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const res = await fetch(
      `${API_URL}/api/cart`,
      withCredentials({
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items: payload }),
        // `keepalive` gives this request its best chance of actually reaching
        // the server if the page navigates away right after this call (e.g.
        // addToCart immediately followed by the user opening /cart, or
        // checkout()'s redirect to '/'). It does not cover the CORS preflight
        // that a cross-origin PUT with a JSON body + credentials triggers, so
        // a fast-enough navigation can still cancel the request before we
        // ever get a response — see the catch block below for how that case
        // is handled.
        keepalive: true,
      })
    );

    if (!res.ok) {
      // The backend saw the request and explicitly rejected this cart
      // state (validation error, auth issue, etc). That is a real failure —
      // but only roll back if no newer sync has started since this one was
      // issued. If a newer call already started, its (likely successful)
      // result supersedes this stale failure, and rolling back here would
      // clobber state the user already saw confirmed.
      if (mySeq === syncSeq) {
        cartItems.set(previousItems);
        persistCart(previousItems);
      }
      window.dispatchEvent(
        new CustomEvent('cart-sync-error', {
          detail: { message: 'No se pudo sincronizar el carrito con el servidor.' },
        })
      );
    }
  } catch {
    // `fetch()` itself threw, meaning we never got a response at all. This
    // is ambiguous — it can mean the network is genuinely down, but in
    // practice it is overwhelmingly the browser cancelling this in-flight
    // request (or its CORS preflight) because the document navigated away
    // right after the optimistic local update was applied. Unlike a
    // confirmed server rejection above, we deliberately do NOT roll back
    // local state here: the optimistic update already reflects what the
    // user did, and undoing it based on a request we cancelled ourselves
    // would silently corrupt state the user already saw applied (e.g. a
    // checkout that reported success). Known limitation: there is no
    // reconciling GET anywhere in the frontend (loadCartFromStorage only
    // reads localStorage), so a genuine dropped network failure does NOT
    // self-heal — it silently persists until the user's next cart mutation,
    // which re-sends the already-diverged local state rather than
    // reconciling against the server.
    window.dispatchEvent(
      new CustomEvent('cart-sync-error', {
        detail: { message: 'No se pudo sincronizar el carrito con el servidor.' },
      })
    );
  }
}

// Trailing-edge debounce sitting between the mutation methods and
// syncToBackend: rapid mutations coalesce into a single PUT carrying the
// cart state as of the last mutation in the burst. A mutation stream
// sustained past SYNC_MAX_WAIT_MS still flushes without waiting for a quiet
// period, so a continuous stream of mutations cannot postpone the sync
// indefinitely.
export const SYNC_DEBOUNCE_MS = 300;
export const SYNC_MAX_WAIT_MS = 1000;

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let maxWaitTimer: ReturnType<typeof setTimeout> | null = null;
let pendingItems: CartItem[] | null = null;
// null doubles as "is a burst open?" and "what is the rollback baseline?".
// previousItems can legitimately be [], so the sentinel must be null, never
// `.length` or `debounceTimer !== null` (the cap timer can fire and leave
// the debounce handle stale for one tick).
let burstPreviousItems: CartItem[] | null = null;

export function scheduleSync(items: CartItem[], previousItems: CartItem[]): void {
  if (!getSessionUser()) return; // Guest carts never arm a timer.

  pendingItems = items; // Latest snapshot wins.

  if (burstPreviousItems === null) {
    // First mutation of this burst: capture the rollback baseline once and
    // arm the ceiling timer once — never re-armed for the rest of the burst.
    burstPreviousItems = previousItems;
    maxWaitTimer = setTimeout(flushCartSync, SYNC_MAX_WAIT_MS);
  }

  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(flushCartSync, SYNC_DEBOUNCE_MS); // Quiet window, re-armed every call.
}

// Clears both timers and resets all scheduler state without issuing a
// request. Production caller: CartService.loadCartFromStorage(), which
// re-establishes the baseline from localStorage and therefore invalidates
// any open burst. Also the test-suite reset hook — module state here is a
// singleton shared across a whole test file.
export function discardPendingSync(): void {
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  if (maxWaitTimer !== null) clearTimeout(maxWaitTimer);
  debounceTimer = null;
  maxWaitTimer = null;
  pendingItems = null;
  burstPreviousItems = null;
}

// Additive accessor consumed by cartHydration.ts's replace-mode guard: true
// while a debounce burst is open (armed by scheduleSync, cleared by
// discardPendingSync/flushCartSync). See burstPreviousItems above for why
// null is the sentinel.
export function hasPendingSync(): boolean {
  return burstPreviousItems !== null;
}

// Returns a Promise so a caller that needs the flushed PUT to actually land
// before doing something else (cartHydration.ts's pre-GET flush) can await
// it. Existing fire-and-forget callers (pagehide/hidden-tab listeners,
// checkout(), the debounce/max-wait timers) are unaffected — they already
// ignore the return value.
export function flushCartSync(): Promise<void> {
  const items = pendingItems;
  const previous = burstPreviousItems;
  // Reset BEFORE issuing the request, so a mutation arriving during the
  // in-flight PUT opens a genuinely new burst instead of being folded into
  // the one that is already in flight.
  discardPendingSync();
  if (items === null || previous === null) return Promise.resolve();
  return syncToBackend(items, previous);
}

let teardownFlushListeners: (() => void) | null = null;

// Binds forced-flush triggers so a pending burst is never lost to page
// unload: `pagehide` on `win`, `visibilitychange` (filtered to `hidden`) on
// `doc`. Idempotent — a second call while already registered returns the
// same teardown without re-binding, mirroring cartBadge.ts's register-once/
// return-cleanup convention. `beforeunload` is deliberately not used.
export function registerCartFlushListeners(
  win: Window = window,
  doc: Document = document
): () => void {
  if (teardownFlushListeners) return teardownFlushListeners;

  const onPagehide = () => flushCartSync();
  const onVisibilityChange = () => {
    if (doc.visibilityState === 'hidden') flushCartSync();
  };

  win.addEventListener('pagehide', onPagehide);
  doc.addEventListener('visibilitychange', onVisibilityChange);

  let active = true;
  const teardown = () => {
    if (!active) return;
    active = false;
    win.removeEventListener('pagehide', onPagehide);
    doc.removeEventListener('visibilitychange', onVisibilityChange);
    teardownFlushListeners = null;
  };
  teardownFlushListeners = teardown;
  return teardown;
}

// Self-register at import so no entry point can forget to wire the forced
// flush. No-op during Astro SSR and under vitest's default `node` test
// environment, where `window`/`document` are undefined at import time.
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  registerCartFlushListeners();
}
