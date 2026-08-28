import { getSessionUser } from '../../../config';
import { cartItems, cartTotal, persistCart, type APICartSyncPayload, type CartItem } from './cartState';
import { discardPendingSync, scheduleSync } from './cartSync';
import { hydrateFromServer, type HydrationResult, type PriceDrift } from './cartHydration';
import { checkout, type CheckoutErrorCode, type CheckoutResult, type StockShortage } from './checkout';

export { cartItems, cartTotal };
export type { CartItem, APICartSyncPayload, HydrationResult, PriceDrift };
export type { CheckoutErrorCode, CheckoutResult, StockShortage };

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

  // Sole entry point for reconciling local cart state against
  // GET /api/cart (cart-hydration spec: "Hydration Entry Point and
  // Triggers"). Thin delegating static — all logic lives in cartHydration.ts.
  static hydrateFromServer(options?: { mergeLocal?: boolean }): Promise<HydrationResult> {
    return hydrateFromServer(options);
  }

  // Sole entry point for POST /api/orders (order-checkout spec). Thin
  // delegating static — all logic lives in checkout.ts, mirroring
  // hydrateFromServer()'s delegation pattern above. Replaces the old fake
  // destroy-and-return-`true` implementation entirely.
  static checkout(): Promise<CheckoutResult> {
    return checkout();
  }
}
