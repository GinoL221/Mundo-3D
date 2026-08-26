import { getSessionUser } from '../../../config';
import { cartItems, cartTotal, persistCart, type APICartSyncPayload, type CartItem } from './cartState';
import { discardPendingSync, flushCartSync, scheduleSync } from './cartSync';

export { cartItems, cartTotal };
export type { CartItem, APICartSyncPayload };

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
    } finally {
      // Re-establishing the baseline from localStorage invalidates any
      // open debounce burst.
      discardPendingSync();
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
    scheduleSync(updated, current);
  }

  static removeFromCart(productId: number): void {
    const current = cartItems.get();
    const updated = current.filter((i) => i.productId !== productId);
    cartItems.set(updated);
    persistCart(updated);
    scheduleSync(updated, current);
  }

  static clearCart(): void {
    const current = cartItems.get();
    cartItems.set([]);
    persistCart([]);
    scheduleSync([], current);
  }

  static hasToken(): boolean {
    return getSessionUser() !== null;
  }

  static checkout(): boolean {
    if (!getSessionUser()) {
      return false;
    }
    // Clear local cart
    const current = cartItems.get();
    cartItems.set([]);
    persistCart([]);
    // Schedule then flush synchronously (never call syncToBackend directly):
    // if a burst is already pending, scheduleSync overwrites pendingItems
    // with [] (the correct end state) while leaving burstPreviousItems at
    // the burst's original baseline (the correct rollback target). A direct
    // call would strand that pending burst. flushCartSync() runs
    // synchronously here, so fetch() is invoked before checkout() returns —
    // identical timing to the previous `void syncToBackend([], current)`.
    scheduleSync([], current);
    flushCartSync();
    return true;
  }
}
