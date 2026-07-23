import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initializeCartBadge } from './cartBadge';
import { initializeCrtToggle } from './crtToggle';
import { initializeSessionUI } from './sessionUI';
import { initializeThemeToggle } from './themeToggle';
import { cartItems } from '../domains/cart/services/CartService';

class FakeElement {
  style: Record<string, string> = {};
  textContent = '';
  src = '';
  href = '';
  clickCount = 0;
  listeners = new Map<string, (event: Event) => void>();

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

  click() {
    this.clickCount += 1;
    this.listeners.get('click')?.({ preventDefault: vi.fn() } as unknown as Event);
  }
}

class FakeDocument {
  elements = new Map<string, FakeElement>();
  documentElement = {
    attributes: new Map<string, string>(),
    classList: {
      values: new Set<string>(),
      add: (value: string) => this.documentElement.classList.values.add(value),
      remove: (value: string) => this.documentElement.classList.values.delete(value),
      contains: (value: string) => this.documentElement.classList.values.has(value),
      toggle: (value: string, force: boolean) => {
        if (force) this.documentElement.classList.values.add(value);
        else this.documentElement.classList.values.delete(value);
      },
    },
    setAttribute: (name: string, value: string) => this.documentElement.attributes.set(name, value),
    getAttribute: (name: string) => this.documentElement.attributes.get(name) ?? null,
  };

  getElementById(id: string) {
    return this.elements.get(id) ?? null;
  }

  querySelectorAll(selector: string) {
    if (selector === '.guest-only') return [this.elements.get('guest')!];
    if (selector === '.user-only') return [this.elements.get('user')!];
    if (selector === '.admin-only') return [this.elements.get('admin')!];
    return [];
  }

  querySelector(selector: string) {
    const ids: Record<string, string> = {
      '.theme-toggle-btn__icon': 'theme-icon',
      '.crt-toggle-btn__icon': 'crt-icon',
    };
    return this.elements.get(ids[selector]) ?? null;
  }
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

function createFixture() {
  const document = new FakeDocument();
  for (const id of [
    'guest',
    'user',
    'admin',
    'navbar-greeting',
    'navbar-avatar',
    'navbar-logout',
    'theme-toggle',
    'theme-icon',
    'crt-toggle',
    'crt-icon',
    'navbar-cart-badge',
    'product-link',
    'profile-link',
    'search-button',
  ]) {
    document.elements.set(id, new FakeElement());
  }
  document.elements.get('product-link')!.href = '/products';
  document.elements.get('profile-link')!.href = '/profile';
  const storage = createStorage();
  const window = {
    listeners: new Map<string, (event: Event) => void>(),
    location: { href: '' },
    dispatchEvent: vi.fn(),
    addEventListener(type: string, listener: (event: Event) => void) {
      this.listeners.set(type, listener);
    },
    removeEventListener(type: string, listener: (event: Event) => void) {
      if (this.listeners.get(type) === listener) this.listeners.delete(type);
    },
  };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('window', window);
  return { document, window, storage };
}

describe('Header browser modules', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders guest, user, and admin visibility and reacts to session events', () => {
    const fixture = createFixture();
    const { document, window, storage } = fixture;
    storage.setItem('token', 'token');
    storage.setItem('user', JSON.stringify({ firstName: 'Ada', idRole: 1, image: 'ada.png' }));

    initializeSessionUI(document as unknown as Document, window as unknown as Window, storage);

    expect(document.elements.get('guest')!.style.display).toBe('none');
    expect(document.elements.get('user')!.style.display).toBe('block');
    expect(document.elements.get('admin')!.style.display).toBe('block');
    expect(document.elements.get('navbar-greeting')!.textContent).toBe('Hola Ada');
    expect(document.elements.get('navbar-avatar')!.src).toBe('/img/users/ada.png');
    expect(document.elements.get('search-button')!.listeners.has('click')).toBe(false);

    storage.removeItem('token');
    storage.removeItem('user');
    window.listeners.get('session-changed')?.({} as Event);
    expect(document.elements.get('guest')!.style.display).toBe('block');
    expect(document.elements.get('user')!.style.display).toBe('none');

    storage.setItem('token', 'token');
    storage.setItem('user', JSON.stringify({ firstName: 'User', idRole: 2 }));
    window.listeners.get('storage')?.({} as Event);
    expect(document.elements.get('user')!.style.display).toBe('block');
    expect(document.elements.get('admin')!.style.display).toBe('none');
  });

  it('preserves navigation and dropdown links while search remains visual-only', () => {
    const fixture = createFixture();
    const { document, window, storage } = fixture;
    storage.setItem('token', 'token');
    storage.setItem('user', JSON.stringify({ firstName: 'Ada', idRole: 1 }));

    initializeSessionUI(document as unknown as Document, window as unknown as Window, storage);

    expect(document.elements.get('product-link')!.href).toBe('/products');
    expect(document.elements.get('profile-link')!.href).toBe('/profile');

    const search = document.elements.get('search-button')!;
    search.click();
    expect(search.clickCount).toBe(1);
    expect(search.listeners.has('click')).toBe(false);
    expect(window.location.href).toBe('');
  });

  it('clears corrupt sessions and performs logout in order', () => {
    const fixture = createFixture();
    const { document, window, storage } = fixture;
    storage.setItem('token', 'token');
    storage.setItem('user', '{bad');
    const order: string[] = [];
    storage.removeItem.mockImplementation((key: string) => order.push(`remove:${key}`));
    storage.setItem.mockImplementation((key: string, value: string) => {
      if (key === 'cart' && value === '[]') order.push('clear-cart');
    });

    initializeSessionUI(document as unknown as Document, window as unknown as Window, storage);
    expect(storage.removeItem).toHaveBeenCalledWith('token');
    expect(storage.removeItem).toHaveBeenCalledWith('user');

    document.elements.get('navbar-logout')!.click();
    expect(order.slice(-3)).toEqual(['remove:token', 'remove:user', 'clear-cart']);
    expect(window.location.href).toBe('/login');
  });

  it('normalizes and persists color theme, including the dark default', () => {
    const fixture = createFixture();
    fixture.storage.setItem('theme', 'invalid');
    initializeThemeToggle(fixture.document as unknown as Document, fixture.storage);
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.document.elements.get('theme-icon')!.textContent).toBe('🌙');

    const cleanup = initializeThemeToggle(fixture.document as unknown as Document, fixture.storage);
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    fixture.document.elements.get('theme-toggle')!.click();
    expect(fixture.storage.setItem).toHaveBeenCalledWith('theme', 'light');
    cleanup();
    cleanup();
  });

  it('hydrates an absent light theme and persists the toggle back to dark', () => {
    const absentFixture = createFixture();
    initializeThemeToggle(absentFixture.document as unknown as Document, absentFixture.storage);
    expect(absentFixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(absentFixture.document.elements.get('theme-icon')!.textContent).toBe('🌙');

    const lightFixture = createFixture();
    lightFixture.storage.setItem('theme', 'light');
    initializeThemeToggle(lightFixture.document as unknown as Document, lightFixture.storage);
    expect(lightFixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(lightFixture.document.elements.get('theme-icon')!.textContent).toBe('☀️');

    lightFixture.document.elements.get('theme-toggle')!.click();
    expect(lightFixture.storage.getItem('theme')).toBe('dark');
    expect(lightFixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(lightFixture.document.elements.get('theme-icon')!.textContent).toBe('🌙');
  });

  it('persists CRT toggles and cleans up duplicate initialization', () => {
    const fixture = createFixture();
    fixture.storage.setItem('retro-theme-preference', 'disabled');
    const cleanup = initializeCrtToggle(fixture.document as unknown as Document, fixture.storage);
    expect(fixture.document.documentElement.classList.contains('crt-theme-active')).toBe(false);
    expect(fixture.document.elements.get('crt-icon')!.textContent).toBe('🔌');
    fixture.document.elements.get('crt-toggle')!.click();
    expect(fixture.storage.setItem).toHaveBeenCalledWith('retro-theme-preference', 'enabled');
    expect(initializeCrtToggle(fixture.document as unknown as Document, fixture.storage)).toBe(
      cleanup,
    );
    cleanup();
    cleanup();
  });

  it('starts CRT enabled and persists the disabled state when toggled off', () => {
    const fixture = createFixture();
    const cleanup = initializeCrtToggle(fixture.document as unknown as Document, fixture.storage);

    expect(fixture.document.documentElement.classList.contains('crt-theme-active')).toBe(true);
    expect(fixture.document.elements.get('crt-icon')!.textContent).toBe('📺');

    fixture.document.elements.get('crt-toggle')!.click();
    expect(fixture.storage.getItem('retro-theme-preference')).toBe('disabled');
    expect(fixture.document.documentElement.classList.contains('crt-theme-active')).toBe(false);
    expect(fixture.document.elements.get('crt-icon')!.textContent).toBe('🔌');

    cleanup();
  });

  it('renders distinct cart items, hides empty state, and unsubscribes', () => {
    const fixture = createFixture();
    fixture.storage.setItem('cart', JSON.stringify([]));
    cartItems.set([]);
    const cleanup = initializeCartBadge(fixture.document as unknown as Document);
    const badge = fixture.document.elements.get('navbar-cart-badge')!;
    expect(badge.style.display).toBe('none');

    cartItems.set([
      { productId: 1, name: 'One', image: 'one.png', unitPrice: 10, quantity: 4 },
      { productId: 2, name: 'Two', image: 'two.png', unitPrice: 20, quantity: 1 },
    ]);
    expect(badge.style.display).toBe('inline-block');
    expect(badge.textContent).toBe('2');

    cartItems.set([]);
    expect(badge.style.display).toBe('none');

    cleanup();
    cartItems.set([
      { productId: 3, name: 'Three', image: 'three.png', unitPrice: 30, quantity: 1 },
    ]);
    expect(badge.style.display).toBe('none');

    const emptyFixture = createFixture();
    const emptyCleanup = initializeCartBadge(emptyFixture.document as unknown as Document);
    expect(emptyFixture.document.elements.get('navbar-cart-badge')!.style.display).toBe('none');
    emptyCleanup();
  });
});
