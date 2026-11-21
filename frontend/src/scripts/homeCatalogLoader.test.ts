import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHomeCatalogLoader, initializeHomeCatalog } from './homeCatalogLoader';

class FakeClassList {
  private values = new Set<string>();

  constructor(initial: string[] = []) {
    for (const value of initial) this.values.add(value);
  }

  add(...tokens: string[]) {
    for (const token of tokens) this.values.add(token);
  }

  contains(token: string): boolean {
    return this.values.has(token);
  }

  clone(): FakeClassList {
    return new FakeClassList([...this.values]);
  }
}

class FakeElement {
  id = '';
  tagName: string;
  className = '';
  classList = new FakeClassList();
  textContent = '';
  hidden = false;
  disabled = false;
  href = '';
  src = '';
  alt = '';
  dataset: Record<string, string> = {};
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(tagName: string, options?: { id?: string; className?: string; textContent?: string; href?: string }) {
    this.tagName = tagName.toLowerCase();
    if (options?.id) this.id = options.id;
    if (options?.className) {
      this.className = options.className;
      for (const token of options.className.split(/\s+/).filter(Boolean)) {
        this.classList.add(token);
      }
    }
    if (options?.textContent) this.textContent = options.textContent;
    if (options?.href) this.href = options.href;
  }

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
    if (name === 'id') this.id = value;
  }

  getAttribute(name: string): string | null {
    if (name === 'href') return this.href || null;
    return this.attributes.get(name) ?? null;
  }

  addEventListener(type: string, listener: (event: Event) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  click() {
    for (const listener of this.listeners.get('click') ?? []) {
      listener({ target: this } as unknown as Event);
    }
  }

  appendChild(node: FakeElement | FakeDocumentFragment) {
    if (node instanceof FakeDocumentFragment) {
      this.children.push(...node.children);
      node.children = [];
      return;
    }
    this.children.push(node);
  }

  replaceChildren(...nodes: Array<FakeElement | FakeDocumentFragment>) {
    this.children = [];
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  cloneDeep(): FakeElement {
    const copy = new FakeElement(this.tagName, {
      id: this.id,
      className: this.className,
      textContent: this.textContent,
      href: this.href,
    });
    copy.classList = this.classList.clone();
    copy.hidden = this.hidden;
    copy.disabled = this.disabled;
    copy.src = this.src;
    copy.alt = this.alt;
    copy.dataset = { ...this.dataset };
    copy.attributes = new Map(this.attributes);
    copy.children = this.children.map((child) => child.cloneDeep());
    return copy;
  }

  matches(selector: string): boolean {
    if (selector.startsWith('.')) {
      const targetClass = selector.slice(1);
      return this.classList.contains(targetClass) || this.className.split(/\s+/).includes(targetClass);
    }
    if (selector.startsWith('#')) {
      return this.id === selector.slice(1);
    }
    return this.tagName === selector.toLowerCase();
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const results: FakeElement[] = [];
    for (const child of this.children) {
      if (child.matches(selector)) results.push(child);
      results.push(...child.querySelectorAll(selector));
    }
    return results;
  }

  findById(id: string): FakeElement | null {
    if (this.id === id) return this;
    for (const child of this.children) {
      const found = child.findById(id);
      if (found) return found;
    }
    return null;
  }
}

class FakeDocumentFragment {
  children: FakeElement[] = [];

  appendChild(node: FakeElement | FakeDocumentFragment) {
    if (node instanceof FakeDocumentFragment) {
      this.children.push(...node.children);
      node.children = [];
      return;
    }
    this.children.push(node);
  }

  querySelector(selector: string): FakeElement | null {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }

  cloneNode(deep?: boolean): FakeDocumentFragment {
    const copy = new FakeDocumentFragment();
    if (deep) {
      copy.children = this.children.map((child) => child.cloneDeep());
    }
    return copy;
  }
}

class FakeTemplateElement extends FakeElement {
  content = new FakeDocumentFragment();

  constructor(id: string, contentNodes: FakeElement[]) {
    super('template', { id });
    this.content.children = contentNodes;
  }
}

class FakeDocument {
  private roots: FakeElement[] = [];

  registerRoot(element: FakeElement) {
    this.roots.push(element);
    return element;
  }

  getElementById(id: string): FakeElement | null {
    for (const root of this.roots) {
      const found = root.findById(id);
      if (found) return found;
    }
    return null;
  }

  createElement(tagName: string): FakeElement {
    return new FakeElement(tagName);
  }

  createDocumentFragment(): FakeDocumentFragment {
    return new FakeDocumentFragment();
  }
}

function el(
  tagName: string,
  options?: { id?: string; className?: string; textContent?: string; href?: string },
  children: FakeElement[] = [],
): FakeElement {
  const node = new FakeElement(tagName, options);
  node.children = children;
  return node;
}

function createHomeFixture() {
  const document = new FakeDocument();

  const featuredLoading = el('p', {
    id: 'home-featured-loading',
    className: 'home-featured-card__state',
    textContent: 'Cargando la pieza destacada...',
  });
  const featuredContent = document.registerRoot(
    el('div', { id: 'home-featured-content', className: 'home-featured-card__content' }, [featuredLoading]),
  );

  const loadingMsg = document.registerRoot(
    el('p', { id: 'home-loading-msg', className: 'home-products__loading', textContent: 'Cargando productos...' }),
  );
  const productsState = document.registerRoot(
    el('div', { id: 'home-products-state', className: 'home-products__state' }),
  );
  productsState.hidden = true;

  const productGrid = el('div', { id: 'home-product-grid', className: 'home-products__grid' });
  const productsContent = document.registerRoot(el('div', { id: 'home-products-content' }, [productGrid]));
  productsContent.hidden = true;

  document.registerRoot(
    new FakeTemplateElement('home-empty-state-template', [
      el('div', { className: 'home-state' }, [
        el('h2', { textContent: 'Todavía no hay piezas en el catálogo' }),
        el('p', { textContent: 'Podés contarnos qué pieza buscás para revisarla como encargo a medida.' }),
        el('a', { className: 'home-text-action', href: '/help', textContent: 'Pedir un encargo a medida' }),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-error-state-template', [
      el('div', { className: 'home-state' }, [
        el('h2', { textContent: 'No se pudo cargar' }),
        el('p', { textContent: 'Verificá tu conexión e intentá de nuevo.' }),
        el('button', { className: 'home-state__retry', textContent: 'Reintentar' }),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-featured-product-template', [
      el('a', { className: 'home-featured-card__link', href: '' }, [
        el('img', { className: 'home-featured-card__image' }),
        el('div', { className: 'home-featured-card__caption' }, [
          el('div', {}, [el('h2', { className: 'home-featured-card__name' })]),
          el('p', { className: 'home-featured-card__price' }),
        ]),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-featured-empty-state-template', [
      el('div', { className: 'home-featured-card__state' }, [
        el('p', { textContent: 'No hay una pieza destacada disponible.' }),
        el('a', { className: 'home-text-action', href: '/products', textContent: 'Ver catálogo' }),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-featured-error-state-template', [
      el('div', { className: 'home-featured-card__state' }, [
        el('p', { textContent: 'No se pudo cargar la pieza destacada. Verificá tu conexión e intentá de nuevo.' }),
        el('button', { className: 'home-state__retry', textContent: 'Reintentar' }),
        el('a', { className: 'home-text-action', href: '/products', textContent: 'Ver catálogo' }),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-product-card-template', [
      el('article', { className: 'home-product-card' }, [
        el('a', { className: 'home-product-card__link', href: '' }, [
          el('div', { className: 'home-product-card__content' }, [
            el('img', { className: 'home-product-card__image' }),
            el('div', { className: 'home-product-card__copy' }, [
              el('h3', { className: 'home-product-card__name' }),
              el('p', { className: 'home-product-card__price' }),
            ]),
          ]),
        ]),
      ]),
    ]),
  );

  return {
    document,
    featuredContent,
    loadingMsg,
    productsState,
    productsContent,
    productGrid,
  };
}

function makeProduct(id: number, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    idProduct: id,
    nameProduct: `Pieza ${id}`,
    price: 1000 * id,
    descriptionProduct: `Descripción ${id}`,
    image: `pieza-${id}.webp`,
    category: 'Figuras',
    ...overrides,
  };
}

const PORTAL_CUBE = makeProduct(47, {
  nameProduct: 'Cubo de Compañía de Portal',
  price: 24500,
  image: 'cubo_compania_portal.jpg',
});

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function flushMicrotasks(ticks = 6) {
  for (let i = 0; i < ticks; i += 1) {
    await Promise.resolve();
  }
}

describe('homeCatalogLoader', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders both error templates with Reintentar on failed fetch and populates up to 6 cards plus featured piece on retry success', async () => {
    const fixture = createHomeFixture();
    const retryCatalogDeferred = createDeferred<ReturnType<typeof jsonResponse>>();

    const fetchMock = vi
      .fn()
      // Initial attempt: /api/products fails, then fallback /api/products/latest fails
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      // Retry attempt: /api/products succeeds with 8 products (including Portal Cube)
      .mockImplementationOnce(() => retryCatalogDeferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    await initializeHomeCatalog(fixture.document as unknown as Document);

    // Both featured and catalogue error states should render with "Reintentar"
    const featuredRetry = fixture.featuredContent.querySelector('.home-state__retry');
    const productsRetry = fixture.productsState.querySelector('.home-state__retry');
    expect(featuredRetry?.textContent).toBe('Reintentar');
    expect(productsRetry?.textContent).toBe('Reintentar');
    expect(fixture.loadingMsg.hidden).toBe(true);
    expect(fixture.productsState.hidden).toBe(false);
    expect(fixture.productsContent.hidden).toBe(true);

    // Clicking Reintentar disables button, restores loading states, and triggers a fresh fetch
    productsRetry!.click();
    expect(productsRetry!.disabled).toBe(true);
    expect(fixture.document.getElementById('home-featured-loading')?.textContent).toBe(
      'Cargando la pieza destacada...',
    );
    expect(fixture.loadingMsg.hidden).toBe(false);
    expect(fixture.productsState.hidden).toBe(true);
    expect(fixture.productsState.children).toHaveLength(0);
    expect(fixture.productsContent.hidden).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Resolve retry fetch with 8 products (sliced to 6 cards)
    const products = [
      PORTAL_CUBE,
      makeProduct(1),
      makeProduct(2),
      makeProduct(3),
      makeProduct(4),
      makeProduct(5),
      makeProduct(6),
      makeProduct(7),
    ];
    retryCatalogDeferred.resolve(jsonResponse(200, { products }));
    await flushMicrotasks();

    expect(fixture.loadingMsg.hidden).toBe(true);
    expect(fixture.productsState.hidden).toBe(true);
    expect(fixture.productsContent.hidden).toBe(false);

    const cards = fixture.productGrid.querySelectorAll('.home-product-card');
    expect(cards).toHaveLength(6);
    expect(cards[0].querySelector('.home-product-card__name')?.textContent).toBe(
      'Cubo de Compañía de Portal',
    );
    expect(cards[0].querySelector('.home-product-card__link')?.href).toBe('/product?id=47');
    expect(cards[5].querySelector('.home-product-card__name')?.textContent).toBe('Pieza 5');

    const featuredLink = fixture.featuredContent.querySelector('.home-featured-card__link');
    const featuredName = fixture.featuredContent.querySelector('.home-featured-card__name');
    expect(featuredLink?.href).toBe('/product?id=47');
    expect(featuredName?.textContent).toBe('Cubo de Compañía de Portal');
  });

  it('ignores stale attempt resolutions and rejections after a newer retry starts', async () => {
    const fixture = createHomeFixture();
    const staleLatestDeferred = createDeferred<ReturnType<typeof jsonResponse>>();
    const retryCatalogDeferred = createDeferred<ReturnType<typeof jsonResponse>>();

    const fetchMock = vi
      .fn()
      // Attempt 1: /api/products fails (renders catalogue retry immediately),
      // while fallback /api/products/latest remains pending.
      .mockResolvedValueOnce(jsonResponse(500, {}))
      .mockImplementationOnce(() => staleLatestDeferred.promise)
      // Attempt 2 (triggered via Reintentar): /api/products succeeds
      .mockImplementationOnce(() => retryCatalogDeferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    const pendingInit = initializeHomeCatalog(fixture.document as unknown as Document);
    await flushMicrotasks();

    const retryButton = fixture.productsState.querySelector('.home-state__retry');
    expect(retryButton?.textContent).toBe('Reintentar');

    // Trigger Attempt 2 before Attempt 1's fallback latest request settles
    retryButton!.click();
    retryCatalogDeferred.resolve(jsonResponse(200, { products: [PORTAL_CUBE, makeProduct(2)] }));
    await flushMicrotasks();

    expect(fixture.featuredContent.querySelector('.home-featured-card__name')?.textContent).toBe(
      'Cubo de Compañía de Portal',
    );
    expect(fixture.productGrid.querySelectorAll('.home-product-card')).toHaveLength(2);

    // Attempt 1's stale fallback resolves late with a different product -> must be ignored
    staleLatestDeferred.resolve(jsonResponse(200, makeProduct(99, { nameProduct: 'Pieza vieja' })));
    await pendingInit;
    await flushMicrotasks();

    expect(fixture.featuredContent.querySelector('.home-featured-card__name')?.textContent).toBe(
      'Cubo de Compañía de Portal',
    );

    // Also prove stale rejection / late /api/products resolution from an earlier attempt is ignored
    const loader = createHomeCatalogLoader(fixture.document as unknown as Document);
    const attemptAProducts = createDeferred<ReturnType<typeof jsonResponse>>();
    const attemptALatest = createDeferred<ReturnType<typeof jsonResponse>>();
    const attemptBProducts = createDeferred<ReturnType<typeof jsonResponse>>();

    const staleFetchMock = vi
      .fn()
      .mockImplementationOnce(() => attemptAProducts.promise)
      .mockImplementationOnce(() => attemptBProducts.promise)
      .mockImplementationOnce(() => attemptALatest.promise);
    vi.stubGlobal('fetch', staleFetchMock);

    const loadA = loader.load();
    const loadB = loader.load();

    attemptBProducts.resolve(jsonResponse(200, { products: [PORTAL_CUBE] }));
    await loadB;

    // Now Attempt A rejects late -> must NOT overwrite Attempt B's render with an error state
    attemptAProducts.reject(new Error('late timeout'));
    attemptALatest.reject(new Error('late fallback timeout'));
    await loadA;
    await flushMicrotasks();

    expect(fixture.featuredContent.querySelector('.home-featured-card__name')?.textContent).toBe(
      'Cubo de Compañía de Portal',
    );
    expect(fixture.productsState.hidden).toBe(true);
    expect(fixture.productsContent.hidden).toBe(false);
    expect(fixture.productGrid.querySelectorAll('.home-product-card')).toHaveLength(1);
  });

  it('renders the empty state template with the /help link and hides loading and content when catalog is empty', async () => {
    const fixture = createHomeFixture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { products: [] }))
      .mockResolvedValueOnce(jsonResponse(404, {}));
    vi.stubGlobal('fetch', fetchMock);

    await initializeHomeCatalog(fixture.document as unknown as Document);

    expect(fixture.loadingMsg.hidden).toBe(true);
    expect(fixture.productsContent.hidden).toBe(true);
    expect(fixture.productsState.hidden).toBe(false);

    const emptyHeading = fixture.productsState.querySelector('h2');
    const helpLink = fixture.productsState.querySelector('.home-text-action');
    expect(emptyHeading?.textContent).toBe('Todavía no hay piezas en el catálogo');
    expect(helpLink?.href).toBe('/help');
    expect(fixture.featuredContent.querySelector('.home-text-action')?.href).toBe('/products');
  });
});
