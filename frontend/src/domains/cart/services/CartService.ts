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

// Background sync to backend API
async function syncToBackend(items: CartItem[]): Promise<void> {
  const token = localStorage.getItem('token');
  if (!token) return; // Not authenticated — skip sync

  const previousItems = cartItems.get();

  try {
    const payload = items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
    const res = await fetch(`${API_URL}/api/cart`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items: payload }),
    });

    if (!res.ok) {
      throw new Error(`Sync failed: ${res.status}`);
    }
  } catch {
    // Revert local state on failure
    cartItems.set(previousItems);
    persistCart(previousItems);
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
    void syncToBackend(updated);
  }

  static removeFromCart(productId: number): void {
    const updated = cartItems.get().filter((i) => i.productId !== productId);
    cartItems.set(updated);
    persistCart(updated);
    void syncToBackend(updated);
  }

  static clearCart(): void {
    cartItems.set([]);
    persistCart([]);
    void syncToBackend([]);
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
      cartItems.set([]);
      persistCart([]);
      void syncToBackend([]);
      return true;
    } catch {
      return false;
    }
  }
}
