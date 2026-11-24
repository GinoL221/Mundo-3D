import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEMO_CSRF_COOKIE_NAME, DEMO_STORAGE_KEY } from '../lib/http/demoSessionState';
import { CartService, cartItems } from '../domains/cart/services/CartService';
import {
  DEMO_CART_STORAGE_KEY,
  STANDARD_CART_STORAGE_KEY,
} from '../domains/cart/services/cartState';
import { initializeSessionUI } from './sessionUI';

function createMemoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

function createFakeDom(initialCookie = '') {
  const cookies = new Map<string, string>();
  for (const part of initialCookie.split('; ').filter(Boolean)) {
    const idx = part.indexOf('=');
    if (idx > 0) cookies.set(part.slice(0, idx), part.slice(idx + 1));
  }
  const listeners = new Map<string, Set<EventListener>>();
  const guestEl = { style: { display: '' } };
  const userEl = { style: { display: 'none' } };
  const adminEl = { style: { display: 'none' } };
  const greeting = { textContent: 'Hola' };
  const avatar = { src: '' };
  const elements = new Map<string, unknown>([
    ['navbar-greeting', greeting],
    ['navbar-avatar', avatar],
  ]);

  const doc = {
    get cookie() {
      return [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
    },
    set cookie(value: string) {
      const [pair, ...attrs] = value.split(';').map((s) => s.trim());
      const idx = pair.indexOf('=');
      if (idx <= 0) return;
      const name = pair.slice(0, idx);
      if (attrs.some((a) => /^max-age=0$/i.test(a))) cookies.delete(name);
      else cookies.set(name, pair.slice(idx + 1));
    },
    getElementById: (id: string) => elements.get(id) ?? null,
    querySelectorAll: (sel: string) => {
      if (sel === '.guest-only') return [guestEl];
      if (sel === '.user-only') return [userEl];
      if (sel === '.admin-only') return [adminEl];
      return [];
    },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as Document;

  const win = {
    location: { href: '/' },
    addEventListener: (type: string, fn: EventListener) => {
      const set = listeners.get(type) ?? new Set();
      set.add(fn);
      listeners.set(type, set);
    },
    removeEventListener: (type: string, fn: EventListener) => {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent: (event: Event) => {
      listeners.get(event.type)?.forEach((fn) => fn(event));
      return true;
    },
  } as unknown as Window;

  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', win);
  return { doc, win, guestEl, userEl, adminEl, greeting };
}

describe('Demo shell integration (sessionUI + m3d_demo_cart)', () => {
  afterEach(() => {
    cartItems.set([]);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('isolates demo cart storage under m3d_demo_cart without overwriting normal cart', () => {
    const local = createMemoryStorage();
    vi.stubGlobal('localStorage', local);
    vi.stubGlobal('sessionStorage', createMemoryStorage());
    const { doc } = createFakeDom(`${DEMO_CSRF_COOKIE_NAME}=demo.sig`);

    local.setItem(
      STANDARD_CART_STORAGE_KEY,
      JSON.stringify([{ productId: 1, name: 'Normal', image: '', unitPrice: 100, quantity: 1 }]),
    );

    CartService.loadCartFromStorage();
    expect(cartItems.get()).toEqual([]);

    CartService.addToCart({ id: 2, name: 'Demo Item', image: '', price: 250 }, 1);
    expect(JSON.parse(local.getItem(DEMO_CART_STORAGE_KEY) ?? '[]')).toHaveLength(1);
    expect(JSON.parse(local.getItem(STANDARD_CART_STORAGE_KEY) ?? '[]')[0].productId).toBe(1);

    doc.cookie = `${DEMO_CSRF_COOKIE_NAME}=; Max-Age=0; path=/`;
    CartService.loadCartFromStorage();
    expect(cartItems.get()).toHaveLength(1);
    expect(cartItems.get()[0]?.productId).toBe(1);
  });

  it('reflects Demo Buyer vs Demo STAFF in HomeHeader visibility and greeting', () => {
    const session = createMemoryStorage();
    vi.stubGlobal('sessionStorage', session);
    const { doc, win, guestEl, userEl, adminEl, greeting } = createFakeDom(
      `${DEMO_CSRF_COOKIE_NAME}=demo.sig`,
    );

    session.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        active: true,
        role: 'USER',
        user: { idUser: 1, firstName: 'Demo', lastName: 'Buyer', email: 'buyer@demo.invalid' },
        lease: {},
      }),
    );

    const cleanup = initializeSessionUI(doc, win);
    expect(guestEl.style.display).toBe('none');
    expect(userEl.style.display).toBe('block');
    expect(adminEl.style.display).toBe('none');
    expect(greeting.textContent).toBe('Demo Buyer');

    session.setItem(
      DEMO_STORAGE_KEY,
      JSON.stringify({
        active: true,
        role: 'STAFF',
        user: { idUser: 2, firstName: 'Demo', lastName: 'Staff', email: 'staff@demo.invalid' },
        lease: {},
      }),
    );
    win.dispatchEvent(new Event('demo-session-changed'));

    expect(adminEl.style.display).toBe('block');
    expect(greeting.textContent).toBe('Demo STAFF');
    cleanup();
  });
});
