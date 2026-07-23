import { cartItems, CartService } from '../domains/cart/services/CartService';

type Cleanup = () => void;
const cleanups = new WeakMap<Document, Cleanup>();

export function initializeCartBadge(document: Document): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;
  const badge = document.getElementById('navbar-cart-badge');
  const render = () => {
    if (!badge) return;
    const count = cartItems.get().length;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
    if (count > 0) badge.textContent = String(count);
  };
  CartService.loadCartFromStorage();
  render();
  const unsubscribe = cartItems.subscribe(render);
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    unsubscribe();
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
