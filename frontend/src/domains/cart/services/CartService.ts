import { getSessionUser } from '../../../config';
import { cartItems, cartTotal, persistCart, type APICartSyncPayload, type CartItem } from './cartState';
import { syncToBackend } from './cartSync';

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
    void syncToBackend([], current);
    return true;
  }
}
