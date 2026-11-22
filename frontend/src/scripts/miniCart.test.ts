import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeMiniCart } from './miniCart';
import { cartItems, CartService } from '../domains/cart/services/CartService';

class FakeElement {
  tagName: string;
  id = '';
  className = '';
  hidden = false;
  textContent = '';
  href = '';
  src = '';
  alt = '';
  width = 0;
  height = 0;
  loading = '';
  decoding = '';
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  focusCount = 0;
  listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(tagName: string, id = '', className = '') {
    this.tagName = tagName.toLowerCase();
    this.id = id;
    this.className = className;
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((entry) => entry !== listener),
    );
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
  }

  getAttribute(name: string): string | null {
    if (name === 'href') return this.href || null;
    if (name === 'src') return this.src || null;
    return this.attributes.get(name) ?? null;
  }

  appendChild(child: FakeElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceChild(newChild: FakeElement, oldChild: FakeElement) {
    const idx = this.children.indexOf(oldChild);
    if (idx === -1) return oldChild;
    oldChild.parentElement = null;
    newChild.parentElement = this;
    this.children[idx] = newChild;
    return oldChild;
  }

  replaceChildren(...nodes: FakeElement[]) {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children = [];
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  contains(target: FakeElement | null): boolean {
    if (!target) return false;
    if (target === this) return true;
    return this.children.some((child) => child.contains(target));
  }

  closest(selector: string): FakeElement | null {
    const targetClass = selector.startsWith('.') ? selector.slice(1) : null;
    if (targetClass && this.className.split(/\s+/).includes(targetClass)) {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }

  querySelector(selector: string): FakeElement | null {
    const targetClass = selector.startsWith('.') ? selector.slice(1) : null;
    for (const child of this.children) {
      if (targetClass ? child.className.split(/\s+/).includes(targetClass) : child.tagName === selector) {
        return child;
      }
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const targetClass = selector.startsWith('.') ? selector.slice(1) : null;
    const matches: FakeElement[] = [];
    for (const child of this.children) {
      if (targetClass ? child.className.split(/\s+/).includes(targetClass) : child.tagName === selector) {
        matches.push(child);
      }
      matches.push(...child.querySelectorAll(selector));
    }
    return matches;
  }

  findById(id: string): FakeElement | null {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findById(id);
      if (found) return found;
    }
    return null;
  }

  focus() {
    this.focusCount += 1;
  }

  dispatchClick(document?: FakeDocument) {
    let stopped = false;
    const event = {
      target: this,
      stopPropagation: () => {
        stopped = true;
      },
      preventDefault: vi.fn(),
    } as unknown as Event;

    for (const listener of this.listeners.get('click') ?? []) {
      listener(event);
    }
    if (!stopped && document) {
      document.dispatchEvent('click', event);
    }
  }

  dispatchError() {
    for (const listener of this.listeners.get('error') ?? []) {
      listener({ target: this } as unknown as Event);
    }
  }
}

class FakeDocument {
  root = new FakeElement('div', 'root');
  outside = new FakeElement('div', 'outside');
  activeElement: FakeElement | null = null;
  listeners = new Map<string, Array<(event: Event) => void>>();

  constructor() {
    this.root.appendChild(this.outside);
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const list = this.listeners.get(type);
    if (!list) return;
    this.listeners.set(
      type,
      list.filter((entry) => entry !== listener),
    );
  }

  dispatchEvent(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  getElementById(id: string): FakeElement | null {
    return this.root.findById(id);
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  createElementNS(_ns: string, tagName: string): FakeElement {
    return new FakeElement(tagName);
  }
}

function createMiniCartFixture() {
  const document = new FakeDocument();
  const wrap = new FakeElement('div', '', 'home-header__cart-wrap');
  const trigger = new FakeElement('button', 'navbar-cart-trigger', 'home-header__link home-header__cart');
  const menu = new FakeElement('div', 'navbar-cart-menu', 'mini-cart');
  const count = new FakeElement('span', 'mini-cart-count', 'mini-cart__count');
  const empty = new FakeElement('div', 'mini-cart-empty', 'mini-cart__empty');
  const emptyLink = new FakeElement('a', '', 'mini-cart__secondary-link');
  const content = new FakeElement('div', 'mini-cart-content', 'mini-cart__content');
  const list = new FakeElement('ul', 'mini-cart-list', 'mini-cart__list');
  const total = new FakeElement('strong', 'mini-cart-total');
  const cta = new FakeElement('a', '', 'mini-cart__cta');
  cta.href = '/cart';

  empty.appendChild(emptyLink);
  content.appendChild(list);
  content.appendChild(total);
  content.appendChild(cta);
  menu.appendChild(count);
  menu.appendChild(empty);
  menu.appendChild(content);
  wrap.appendChild(trigger);
  wrap.appendChild(menu);
  document.root.appendChild(wrap);

  return { document, wrap, trigger, menu, count, empty, emptyLink, content, list, total, cta };
}

afterEach(() => {
  cartItems.set([]);
  vi.restoreAllMocks();
});

describe('initializeMiniCart', () => {
  it('renders empty state, toggles aria-expanded/hidden on trigger click, closes on Escape with focus restore, and closes on outside click', () => {
    cartItems.set([]);
    const fixture = createMiniCartFixture();
    const cleanup = initializeMiniCart(fixture.document as unknown as Document);

    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.empty.hidden).toBe(false);
    expect(fixture.content.hidden).toBe(true);
    expect(fixture.count.textContent).toBe('');

    // Idempotent initialization returns the same cleanup
    expect(initializeMiniCart(fixture.document as unknown as Document)).toBe(cleanup);

    // Click trigger -> opens
    fixture.trigger.dispatchClick(fixture.document);
    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('true');

    // Click inside menu -> stays open
    fixture.menu.dispatchClick(fixture.document);
    expect(fixture.menu.hidden).toBe(false);

    // Click trigger again -> closes
    fixture.trigger.dispatchClick(fixture.document);
    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('false');

    // Open and press Escape -> closes and restores focus
    fixture.trigger.dispatchClick(fixture.document);
    const preventDefault = vi.fn();
    fixture.document.dispatchEvent('keydown', { key: 'Escape', preventDefault } as unknown as Event);
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.trigger.focusCount).toBe(1);

    // Open and click outside -> closes without moving focus
    fixture.trigger.dispatchClick(fixture.document);
    expect(fixture.menu.hidden).toBe(false);
    fixture.document.outside.dispatchClick(fixture.document);
    expect(fixture.menu.hidden).toBe(true);
    expect(fixture.trigger.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.trigger.focusCount).toBe(1);

    cleanup();
  });

  it('renders populated items safely, formats ARS prices, reacts to cartItems changes, and removes items without closing', () => {
    const removeSpy = vi.spyOn(CartService, 'removeFromCart').mockImplementation((productId: number) => {
      cartItems.set(cartItems.get().filter((item) => item.productId !== productId));
    });

    cartItems.set([
      {
        productId: 7,
        name: '<img src=x onerror=alert(1)> Cubo',
        image: 'cubo.webp',
        unitPrice: 1900,
        quantity: 2,
      },
      {
        productId: 12,
        name: 'Maceta Hexagonal',
        image: '',
        unitPrice: 8700,
        quantity: 1,
      },
    ]);

    const fixture = createMiniCartFixture();
    const cleanup = initializeMiniCart(fixture.document as unknown as Document);

    expect(fixture.empty.hidden).toBe(true);
    expect(fixture.content.hidden).toBe(false);
    expect(fixture.count.textContent).toBe('2 productos');
    expect(fixture.total.textContent).toBe('$ 12.500');

    const rows = fixture.list.querySelectorAll('.mini-cart__item');
    expect(rows).toHaveLength(2);

    const firstLink = rows[0].querySelector('.mini-cart__name')!;
    expect(firstLink.href).toBe('/product?id=7');
    expect(firstLink.textContent).toBe('<img src=x onerror=alert(1)> Cubo');
    // No injected HTML img elements inside the link
    expect(firstLink.children).toHaveLength(0);

    const firstThumb = rows[0].querySelector('.mini-cart__thumb')!;
    expect(firstThumb.src).toBe('/img/products/cubo.webp');
    firstThumb.dispatchError();
    const replacedThumb = rows[0].querySelector('.mini-cart__thumb--placeholder');
    expect(replacedThumb).not.toBeNull();
    expect(rows[0].querySelector('img')).toBeNull();

    const firstMeta = rows[0].querySelector('.mini-cart__meta')!;
    expect(firstMeta.textContent).toBe('2 × $ 1.900 · $ 3.800');

    const secondPlaceholder = rows[1].querySelector('.mini-cart__thumb--placeholder');
    expect(secondPlaceholder).not.toBeNull();
    expect(rows[1].querySelector('img')).toBeNull();

    // Open menu and click remove on first item -> stops propagation, stays open, updates reactively
    fixture.trigger.dispatchClick(fixture.document);
    expect(fixture.menu.hidden).toBe(false);

    const firstRemove = rows[0].querySelector('.mini-cart__remove')!;
    expect(firstRemove.getAttribute('aria-label')).toBe('Quitar <img src=x onerror=alert(1)> Cubo del carrito');
    firstRemove.dispatchClick(fixture.document);

    expect(removeSpy).toHaveBeenCalledWith(7);
    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.count.textContent).toBe('1 producto');
    expect(fixture.total.textContent).toBe('$ 8.700');
    expect(fixture.list.querySelectorAll('.mini-cart__item')).toHaveLength(1);

    // Removing last item switches back to empty state while staying open
    fixture.list.querySelector('.mini-cart__remove')!.dispatchClick(fixture.document);
    expect(removeSpy).toHaveBeenCalledWith(12);
    expect(fixture.menu.hidden).toBe(false);
    expect(fixture.empty.hidden).toBe(false);
    expect(fixture.content.hidden).toBe(true);
    expect(fixture.count.textContent).toBe('');

    cleanup();
  });

  it('restores keyboard focus to the next remove button and then to the empty-state link when removing items', () => {
    vi.spyOn(CartService, 'removeFromCart').mockImplementation((productId: number) => {
      cartItems.set(cartItems.get().filter((item) => item.productId !== productId));
    });

    cartItems.set([
      { productId: 1, name: 'Pieza A', image: 'a.jpg', unitPrice: 1000, quantity: 1 },
      { productId: 2, name: 'Pieza B', image: 'b.jpg', unitPrice: 2000, quantity: 1 },
    ]);

    const fixture = createMiniCartFixture();
    const cleanup = initializeMiniCart(fixture.document as unknown as Document);

    fixture.trigger.dispatchClick(fixture.document);
    const firstRemove = fixture.list.querySelectorAll('.mini-cart__remove')[0];
    fixture.document.activeElement = firstRemove;
    firstRemove.dispatchClick(fixture.document);

    const remainingRemove = fixture.list.querySelector('.mini-cart__remove')!;
    expect(remainingRemove.focusCount).toBe(1);

    fixture.document.activeElement = remainingRemove;
    remainingRemove.dispatchClick(fixture.document);
    expect(fixture.emptyLink.focusCount).toBe(1);

    cleanup();
  });

  it('normalizes pre-prefixed /img/products/ cart images and treats legacy illustration paths as placeholders', () => {
    cartItems.set([
      {
        productId: 1,
        name: 'Mario Bros Coleccionable',
        image: '/img/products/figura_mario.jpg',
        unitPrice: 1500,
        quantity: 1,
      },
      {
        productId: 2,
        name: 'Pieza sin foto',
        image: '/images/illustrations/Figura.svg',
        unitPrice: 800,
        quantity: 1,
      },
    ]);

    const fixture = createMiniCartFixture();
    const cleanup = initializeMiniCart(fixture.document as unknown as Document);
    const rows = fixture.list.querySelectorAll('.mini-cart__item');

    const marioThumb = rows[0].querySelector('img')!;
    expect(marioThumb).not.toBeNull();
    expect(marioThumb.src).toBe('/img/products/figura_mario.jpg');

    expect(rows[1].querySelector('img')).toBeNull();
    expect(rows[1].querySelector('.mini-cart__thumb--placeholder')).not.toBeNull();

    cleanup();
  });

  it('unsubscribes from cartItems and removes all listeners on cleanup', () => {
    const fixture = createMiniCartFixture();
    const cleanup = initializeMiniCart(fixture.document as unknown as Document);

    cleanup();

    expect(fixture.trigger.listeners.get('click') ?? []).toHaveLength(0);
    expect(fixture.document.listeners.get('keydown') ?? []).toHaveLength(0);
    expect(fixture.document.listeners.get('click') ?? []).toHaveLength(0);

    cartItems.set([
      {
        productId: 99,
        name: 'Post cleanup',
        image: 'post.png',
        unitPrice: 500,
        quantity: 1,
      },
    ]);

    expect(fixture.list.children).toHaveLength(0);
    expect(fixture.empty.hidden).toBe(false);
  });
});
