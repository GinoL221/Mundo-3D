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
