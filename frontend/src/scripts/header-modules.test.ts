import { afterEach, describe, expect, it, vi } from 'vitest';
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
  cookie = '';
  listeners = new Map<string, (event: Event) => void>();
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

  addEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    if (this.listeners.get(type) === listener) this.listeners.delete(type);
  }

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

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  postMessage = vi.fn();
  close = vi.fn();

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }
}

function setUserCookie(document: FakeDocument, user: Record<string, unknown>) {
  document.cookie = `m3d_user=${encodeURIComponent(JSON.stringify(user))}`;
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string): string | null => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string): void => {
      values.set(key, value);
    }),
    removeItem: vi.fn((key: string): void => {
      values.delete(key);
    }),
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

  it('renders guest, user, and admin visibility and reacts to session-changed and BroadcastChannel events', () => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    const fixture = createFixture();
    const { document, window } = fixture;
    setUserCookie(document, { firstName: 'Ada', idRole: 1, image: 'ada.png' });

    initializeSessionUI(document as unknown as Document, window as unknown as Window);

    expect(document.elements.get('guest')!.style.display).toBe('none');
    expect(document.elements.get('user')!.style.display).toBe('block');
    expect(document.elements.get('admin')!.style.display).toBe('block');
    expect(document.elements.get('navbar-greeting')!.textContent).toBe('Hola Ada');
    expect(document.elements.get('navbar-avatar')!.src).toBe('/img/users/ada.png');
    expect(document.elements.get('search-button')!.listeners.has('click')).toBe(false);

    document.cookie = '';
    window.listeners.get('session-changed')?.({} as Event);
    expect(document.elements.get('guest')!.style.display).toBe('block');
    expect(document.elements.get('user')!.style.display).toBe('none');

    // A BroadcastChannel message from another tab (e.g. that tab logging
    // out and back in as staff) re-reads the cookie the same way.
    setUserCookie(document, { firstName: 'User', idRole: 3 });
    const channel = FakeBroadcastChannel.instances.at(-1)!;
    channel.onmessage?.({} as MessageEvent);
    expect(document.elements.get('user')!.style.display).toBe('block');
    expect(document.elements.get('admin')!.style.display).toBe('block');
  });

  it('falls back to visibilitychange and focus to refresh stale session state', () => {
    const fixture = createFixture();
    const { document, window } = fixture;

    initializeSessionUI(document as unknown as Document, window as unknown as Window);
    expect(document.elements.get('user')!.style.display).toBe('none');

    setUserCookie(document, { firstName: 'Ada', idRole: 2 });
    document.listeners.get('visibilitychange')?.({} as Event);
    expect(document.elements.get('user')!.style.display).toBe('block');

    document.cookie = '';
    window.listeners.get('focus')?.({} as Event);
    expect(document.elements.get('user')!.style.display).toBe('none');
  });

  it('preserves navigation and dropdown links while search remains visual-only', () => {
    const fixture = createFixture();
    const { document, window } = fixture;
    setUserCookie(document, { firstName: 'Ada', idRole: 1 });

    initializeSessionUI(document as unknown as Document, window as unknown as Window);

    expect(document.elements.get('product-link')!.href).toBe('/products');
    expect(document.elements.get('profile-link')!.href).toBe('/profile');

    const search = document.elements.get('search-button')!;
    search.click();
    expect(search.clickCount).toBe(1);
    expect(search.listeners.has('click')).toBe(false);
    expect(window.location.href).toBe('');
  });

  it('resets to guest without throwing on a corrupt session cookie', () => {
    const fixture = createFixture();
    const { document, window } = fixture;
    document.cookie = 'm3d_user=%7Bnot-valid-json';

    expect(() =>
      initializeSessionUI(document as unknown as Document, window as unknown as Window),
    ).not.toThrow();
    expect(document.elements.get('guest')!.style.display).toBe('block');
    expect(document.elements.get('user')!.style.display).toBe('none');
  });

  it('performs logout by clearing the cart, best-effort clearing the session, and redirecting', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const fixture = createFixture();
    const { document, window } = fixture;
    setUserCookie(document, { firstName: 'Ada', idRole: 1 });

    initializeSessionUI(document as unknown as Document, window as unknown as Window);

    document.elements.get('navbar-logout')!.click();

    // Redirect happens immediately — logout never blocks on the network
    // call (fire-and-forget, see session.service.ts clearSession()).
    expect(window.location.href).toBe('/login');
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toContain('/api/users/logout');
  });

  it('closes the BroadcastChannel and removes all listeners on cleanup', () => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    const fixture = createFixture();
    const { document, window } = fixture;

    const cleanup = initializeSessionUI(document as unknown as Document, window as unknown as Window);
    const channel = FakeBroadcastChannel.instances.at(-1)!;

    cleanup();

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(window.listeners.has('session-changed')).toBe(false);
    expect(window.listeners.has('focus')).toBe(false);
    expect(document.listeners.has('visibilitychange')).toBe(false);
  });

  it('normalizes and persists color theme, including the dark default', () => {
    const fixture = createFixture();
    fixture.storage.setItem('theme', 'invalid');
    initializeThemeToggle(
      fixture.document as unknown as Document,
      fixture.storage as unknown as Storage,
    );
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.document.elements.get('theme-icon')!.textContent).toBe('🌙');

    const cleanup = initializeThemeToggle(
      fixture.document as unknown as Document,
      fixture.storage as unknown as Storage,
    );
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    fixture.document.elements.get('theme-toggle')!.click();
    expect(fixture.storage.setItem).toHaveBeenCalledWith('theme', 'light');
    cleanup();
    cleanup();
  });

  it('hydrates an absent light theme and persists the toggle back to dark', () => {
    const absentFixture = createFixture();
    initializeThemeToggle(
      absentFixture.document as unknown as Document,
      absentFixture.storage as unknown as Storage,
    );
    expect(absentFixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(absentFixture.document.elements.get('theme-icon')!.textContent).toBe('🌙');

    const lightFixture = createFixture();
    lightFixture.storage.setItem('theme', 'light');
    initializeThemeToggle(
      lightFixture.document as unknown as Document,
      lightFixture.storage as unknown as Storage,
    );
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
    const cleanup = initializeCrtToggle(
      fixture.document as unknown as Document,
      fixture.storage as unknown as Storage,
    );
    expect(fixture.document.documentElement.classList.contains('crt-theme-active')).toBe(false);
    expect(fixture.document.elements.get('crt-icon')!.textContent).toBe('🔌');
    fixture.document.elements.get('crt-toggle')!.click();
    expect(fixture.storage.setItem).toHaveBeenCalledWith('retro-theme-preference', 'enabled');
    expect(
      initializeCrtToggle(
        fixture.document as unknown as Document,
        fixture.storage as unknown as Storage,
      ),
    ).toBe(cleanup);
    cleanup();
    cleanup();
  });

  it('starts CRT enabled and persists the disabled state when toggled off', () => {
    const fixture = createFixture();
    const cleanup = initializeCrtToggle(
      fixture.document as unknown as Document,
      fixture.storage as unknown as Storage,
    );

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
