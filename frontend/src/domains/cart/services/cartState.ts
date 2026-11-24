import { atom, computed } from 'nanostores';
import { isDemoSessionActive } from '../../../config';

export const STANDARD_CART_STORAGE_KEY = 'cart';
export const DEMO_CART_STORAGE_KEY = 'm3d_demo_cart';

export function getCartStorageKey(): string {
  return isDemoSessionActive() ? DEMO_CART_STORAGE_KEY : STANDARD_CART_STORAGE_KEY;
}

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
  items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
);

// Persist cart to localStorage
export function persistCart(items: CartItem[]): void {
  try {
    localStorage.setItem(getCartStorageKey(), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart-updated', { detail: { count: items.length } }));
  } catch {
    // localStorage may be unavailable in SSR context
  }
}
