import { atom, computed } from 'nanostores';
import { API_URL } from '../../../config';

export interface CartItem {
  productId: number;
  name: string;
  image: string;
  unitPrice: number;
  quantity: number;
}

export interface APICartSyncPayload {
  items: {
    productId: number;
    quantity: number;
  }[];
}

// Core state atoms
export const cartItems = atom<CartItem[]>([]);

// Computed total
export const cartTotal = computed(cartItems, (items) =>
  items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
);

// Persist cart to localStorage
function persistCart(items: CartItem[]): void {
  try {
    localStorage.setItem('cart', JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: items.length } }));
  } catch {
    // localStorage may be unavailable in SSR context
  }
}

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
async function syncToBackend(items: CartItem[], previousItems: CartItem[]): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) return; // Not authenticated — skip sync

  const mySeq = ++syncSeq;

  try {
    const payload = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const res = await fetch(`${API_URL}/api/cart`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: payload }),
      // `keepalive` gives this request its best chance of actually reaching
      // the server if the page navigates away right after this call (e.g.
      // addToCart immediately followed by the user opening /cart, or
      // checkout()'s redirect to '/'). It does not cover the CORS preflight
      // that a cross-origin PUT with a JSON body + Authorization header
      // triggers, so a fast-enough navigation can still cancel the request
      // before we ever get a response — see the catch block below for how
      // that case is handled.
      keepalive: true,
    });

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

export class CartService {
  static loadCartFromStorage(): void {
    try {
      const raw = localStorage.getItem('cart');
      if (raw) {
        const parsed = JSON.parse(raw) as CartItem[];
        if (Array.isArray(parsed)) {
          cartItems.set(parsed);
          return;
        }
      }
    } catch {
      // Ignored
    }
    cartItems.set([]);
  }

  static addToCart(product: { id: number; name: string; image: string; price: number }, qty = 1): void {
    const current = cartItems.get();
    const existing = current.find((i) => i.productId === product.id);

    let updated: CartItem[];
    if (existing) {
      updated = current.map((i) =>
        i.productId === product.id ? { ...i, quantity: i.quantity + qty } : i
      );
    } else {
      updated = [
        ...current,
        {
          productId: product.id,
          name: product.name,
          image: product.image,
          unitPrice: product.price,
          quantity: qty,
        },
      ];
    }

    cartItems.set(updated);
    persistCart(updated);
    void syncToBackend(updated, current);
  }

  static removeFromCart(productId: number): void {
    const current = cartItems.get();
    const updated = current.filter((i) => i.productId !== productId);
    cartItems.set(updated);
    persistCart(updated);
    void syncToBackend(updated, current);
  }

  static clearCart(): void {
    const current = cartItems.get();
    cartItems.set([]);
    persistCart([]);
    void syncToBackend([], current);
  }

  static hasToken(): boolean {
    try {
      return !!localStorage.getItem('token');
    } catch {
      return false;
    }
  }

  static checkout(): boolean {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return false;
      }
      // Clear local cart
      const current = cartItems.get();
      cartItems.set([]);
      persistCart([]);
      void syncToBackend([], current);
      return true;
    } catch {
      return false;
    }
  }
}
