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
  parentNode: FakeElement | null = null;
  listeners = new Map<string, Array<(event: Event) => void>>();

  constructor(
    tagName: string,
    options?: { id?: string; className?: string; textContent?: string; href?: string },
  ) {
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

  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  append(...nodes: Array<FakeElement | FakeDocumentFragment>) {
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  appendChild(node: FakeElement | FakeDocumentFragment) {
    if (node instanceof FakeDocumentFragment) {
      for (const child of node.children) {
        child.parentNode = this;
        this.children.push(child);
      }
      node.children = [];
      return;
    }
    node.parentNode = this;
    this.children.push(node);
  }

  replaceChildren(...nodes: Array<FakeElement | FakeDocumentFragment>) {
    for (const child of this.children) {
      child.parentNode = null;
    }
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
    copy.children = this.children.map((child) => {
      const clonedChild = child.cloneDeep();
      clonedChild.parentNode = copy;
      return clonedChild;
    });
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
  visibilityState: 'visible' | 'hidden' = 'visible';
  private listeners = new Map<string, Array<(event: Event) => void>>();

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

  addEventListener(type: string, listener: (event: Event) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(
      type,
      list.filter((entry) => entry !== listener),
    );
  }

  dispatchEvent(type: string) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener({ type } as Event);
    }
  }
}

function el(
  tagName: string,
  options?: { id?: string; className?: string; textContent?: string; href?: string },
  children: FakeElement[] = [],
): FakeElement {
  const node = new FakeElement(tagName, options);
  for (const child of children) {
    node.appendChild(child);
  }
  return node;
}

function createHomeFixture() {
  const document = new FakeDocument();

  const featuredLoading = el(
    'div',
    {
      id: 'home-featured-loading',
      className: 'hero-specimen__skeleton',
    },
    [
      el('span', { className: 'hero-specimen__skeleton-media ui-skeleton' }),
      el('span', { className: 'sr-only', textContent: 'Cargando pieza destacada…' }),
    ],
  );
  featuredLoading.setAttribute('role', 'status');
  featuredLoading.setAttribute('aria-busy', 'true');

  const featuredContent = document.registerRoot(
    el('div', { id: 'home-featured-content', className: 'hero-specimen' }, [featuredLoading]),
  );

  const loadingMsg = document.registerRoot(
    el('div', { id: 'home-loading-msg', className: 'home-products__loading' }, [
      el('span', { className: 'sr-only', textContent: 'Cargando piezas…' }),
    ]),
  );
  loadingMsg.setAttribute('role', 'status');
  loadingMsg.setAttribute('aria-busy', 'true');

  const productsState = document.registerRoot(
    el('div', { id: 'home-products-state', className: 'home-products__state' }),
  );
  productsState.hidden = true;

  const productGrid = el('div', { id: 'home-product-grid', className: 'home-products__grid' });
  const productsContent = document.registerRoot(el('div', { id: 'home-products-content' }, [productGrid]));
  productsContent.hidden = true;

  document.registerRoot(
    new FakeTemplateElement('home-empty-state-template', [
      el('div', { className: 'ui-state ui-state--empty home-state' }, [
        el('h3', { className: 'ui-state__title', textContent: 'Todavía no hay piezas en el catálogo.' }),
        el('p', {
          className: 'ui-state__text',
          textContent:
            'Si buscás algo puntual, podés enviar una solicitud de encargo para que la revisemos.',
        }),
        el('a', { className: 'home-text-link', href: '/help', textContent: 'Enviar solicitud de encargo' }),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-error-state-template', [
      el('div', { className: 'ui-callout ui-callout--danger home-state home-state--error' }, [
        el('div', { className: 'ui-callout__content' }, [
          el('h3', { className: 'ui-callout__title', textContent: 'No se pudo cargar el catálogo' }),
          el('p', {
            className: 'ui-callout__text',
            textContent: 'Verificá la conexión e intentá de nuevo.',
          }),
          el('div', { className: 'ui-callout__actions' }, [
            el('button', { className: 'ui-btn ui-btn--secondary home-state__retry', textContent: 'Reintentar' }),
          ]),
        ]),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-featured-product-template', [
      el('figure', { className: 'hero-specimen__figure' }, [
        el('a', { className: 'hero-specimen__media', href: '' }, [
          el('img', { className: 'hero-specimen__image' }),
        ]),
        el('figcaption', { className: 'hero-specimen__sheet' }, [
          el('p', { className: 'hero-specimen__reason', textContent: 'La última pieza que salió del taller.' }),
          el('div', { className: 'hero-specimen__head' }, [
            el('h2', { className: 'hero-specimen__name' }),
            el('p', { className: 'hero-specimen__price' }),
          ]),
          el('dl', { className: 'hero-specimen__specs' }, [
            el('div', { className: 'hero-specimen__spec hero-specimen__spec--category' }, [
              el('dt', { textContent: 'Categoría' }),
              el('dd'),
            ]),
            el('div', { className: 'hero-specimen__spec hero-specimen__spec--material' }, [
              el('dt', { textContent: 'Material' }),
              el('dd'),
            ]),
            el('div', { className: 'hero-specimen__spec hero-specimen__spec--dimensions' }, [
              el('dt', { textContent: 'Dimensiones' }),
              el('dd'),
            ]),
          ]),
          el('div', { className: 'hero-specimen__footer' }, [
            el('a', { className: 'hero-specimen__cta', href: '', textContent: 'Ver la pieza →' }),
          ]),
        ]),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-featured-empty-state-template', [
      el('div', { className: 'ui-state ui-state--empty hero-specimen__state' }, [
        el('h3', { className: 'ui-state__title', textContent: 'Todavía no hay una pieza destacada.' }),
        el('a', { className: 'home-text-link', href: '/products', textContent: 'Ver el catálogo' }),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-featured-error-state-template', [
      el('div', { className: 'ui-callout ui-callout--danger hero-specimen__state hero-specimen__state--error' }, [
        el('div', { className: 'ui-callout__content' }, [
          el('h3', { className: 'ui-callout__title', textContent: 'No se pudo cargar la pieza destacada' }),
          el('p', {
            className: 'ui-callout__text',
            textContent: 'Verificá la conexión e intentá de nuevo.',
          }),
          el('div', { className: 'ui-callout__actions' }, [
            el('button', { className: 'ui-btn ui-btn--secondary home-state__retry', textContent: 'Reintentar' }),
            el('a', { className: 'home-text-link', href: '/products', textContent: 'Ver el catálogo' }),
          ]),
        ]),
      ]),
    ]),
  );

  document.registerRoot(
    new FakeTemplateElement('home-product-card-template', [
      el('article', { className: 'home-product-card' }, [
        el('a', { className: 'home-product-card__link', href: '' }, [
          el('div', { className: 'home-product-card__media' }, [
            el('img', { className: 'home-product-card__image' }),
          ]),
          el('div', { className: 'home-product-card__body' }, [
            el('h3', { className: 'home-product-card__name' }),
            el('div', { className: 'home-product-card__footer' }, [
              el('p', { className: 'home-product-card__price' }),
              el('p', { className: 'home-product-card__category' }),
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

  it('shows a single retry on full API failure and populates hero specimen plus up to 6 non-duplicate cards on retry success', async () => {
    const fixture = createHomeFixture();
    const retryCatalogDeferred = createDeferred<ReturnType<typeof jsonResponse>>();

    const fetchMock = vi
      .fn()
      // Initial attempt: /api/products fails, then fallback /api/products/latest fails
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValueOnce(jsonResponse(500, {}))
      // Retry attempt: /api/products succeeds with 8 products (including Portal Cube id 47)
      .mockImplementationOnce(() => retryCatalogDeferred.promise);
    vi.stubGlobal('fetch', fetchMock);

    await initializeHomeCatalog(fixture.document as unknown as Document);

    // Full API failure: featured suppresses duplicate retry; catalogue renders the single retry
    const featuredRetry = fixture.featuredContent.querySelector('.home-state__retry');
    const productsRetry = fixture.productsState.querySelector('.home-state__retry');
    expect(featuredRetry).toBeNull();
    expect(productsRetry?.textContent).toBe('Reintentar');
    expect(fixture.loadingMsg.hidden).toBe(true);
    expect(fixture.productsState.hidden).toBe(false);
    expect(fixture.productsContent.hidden).toBe(true);

    // Clicking Reintentar disables button, restores loading states, and triggers a fresh fetch
    productsRetry!.click();
    expect(productsRetry!.disabled).toBe(true);
    const featuredSkeleton = fixture.document.getElementById('home-featured-loading');
    expect(featuredSkeleton?.getAttribute('aria-busy')).toBe('true');
    expect(featuredSkeleton?.querySelector('.sr-only')?.textContent).toBe('Cargando pieza destacada…');
    expect(fixture.loadingMsg.hidden).toBe(false);
    expect(fixture.productsState.hidden).toBe(true);
    expect(fixture.productsState.children).toHaveLength(0);
    expect(fixture.productsContent.hidden).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Resolve retry fetch with 8 products: id 47 becomes hero specimen and is excluded from the 6 cards
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
    expect(cards[0].querySelector('.home-product-card__category')?.textContent).toBe('Figuras');
    expect(cards[0].querySelector('.home-product-card__name')?.textContent).toBe('Pieza 1');
    expect(cards[0].querySelector('.home-product-card__link')?.href).toBe('/product?id=1');
    expect(cards[5].querySelector('.home-product-card__name')?.textContent).toBe('Pieza 6');

    const featuredLink = fixture.featuredContent.querySelector('.hero-specimen__media');
    const featuredName = fixture.featuredContent.querySelector('.hero-specimen__name');
    const featuredCta = fixture.featuredContent.querySelector('.hero-specimen__cta');
    expect(featuredLink?.href).toBe('/product?id=47');
    expect(featuredName?.textContent).toBe('Cubo de Compañía de Portal');
    expect(featuredCta?.href).toBe('/product?id=47');
  });

  it('hides null material and dimensions spec cells while formatting available specs cleanly', async () => {
    const fixture = createHomeFixture();
    const sparseProduct = makeProduct(10, {
      nameProduct: 'Soporte Maceta Groot',
      category: 'Otras',
      material: null,
      height: null,
      width: null,
      depth: null,
    });
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { products: [sparseProduct] }));
    vi.stubGlobal('fetch', fetchMock);

    await initializeHomeCatalog(fixture.document as unknown as Document);

    expect(
      fixture.featuredContent.querySelector('.hero-specimen__spec--category')?.querySelector('dd')
        ?.textContent,
    ).toBe('Otras');
    expect(fixture.featuredContent.querySelector('.hero-specimen__spec--material')).toBeNull();
    expect(fixture.featuredContent.querySelector('.hero-specimen__spec--dimensions')).toBeNull();

    const fullProduct = makeProduct(20, {
      nameProduct: 'Busto Iron Man',
      category: 'Busto',
      material: 'PLA+',
      height: 15,
      width: 12,
      depth: 10,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(jsonResponse(200, { products: [fullProduct] })),
    );

    await initializeHomeCatalog(fixture.document as unknown as Document);

    expect(
      fixture.featuredContent.querySelector('.hero-specimen__spec--material')?.querySelector('dd')
        ?.textContent,
    ).toBe('PLA+');
    expect(
      fixture.featuredContent.querySelector('.hero-specimen__spec--dimensions')?.querySelector('dd')
        ?.textContent,
    ).toBe('15 × 12 × 10 cm');
  });

  it('keeps retry button on hero specimen when only latest endpoint fails while catalog is empty', async () => {
    const fixture = createHomeFixture();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { products: [] }))
      .mockResolvedValueOnce(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchMock);

    await initializeHomeCatalog(fixture.document as unknown as Document);

    expect(fixture.productsState.querySelector('.home-state__retry')).toBeNull();
    expect(fixture.featuredContent.querySelector('.home-state__retry')?.textContent).toBe(
      'Reintentar',
    );
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

    expect(fixture.featuredContent.querySelector('.hero-specimen__name')?.textContent).toBe(
      'Cubo de Compañía de Portal',
    );
    expect(fixture.productGrid.querySelectorAll('.home-product-card')).toHaveLength(2);

    // Attempt 1's stale fallback resolves late with a different product -> must be ignored
    staleLatestDeferred.resolve(jsonResponse(200, makeProduct(99, { nameProduct: 'Pieza vieja' })));
    await pendingInit;
    await flushMicrotasks();

    expect(fixture.featuredContent.querySelector('.hero-specimen__name')?.textContent).toBe(
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

    expect(fixture.featuredContent.querySelector('.hero-specimen__name')?.textContent).toBe(
      'Cubo de Compañía de Portal',
    );
    expect(fixture.productsState.hidden).toBe(true);
    expect(fixture.productsContent.hidden).toBe(false);
    expect(fixture.productGrid.querySelectorAll('.home-product-card')).toHaveLength(1);
  });

  it('renders the empty state template with h3 and /help link when catalog is empty', async () => {
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

    const emptyHeading = fixture.productsState.querySelector('h3');
    const helpLink = fixture.productsState.querySelector('.home-text-link');
    expect(emptyHeading?.textContent).toBe('Todavía no hay piezas en el catálogo.');
    expect(helpLink?.href).toBe('/help');
    expect(fixture.featuredContent.querySelector('.home-text-link')?.href).toBe('/products');
  });

  it('uses explicit fallback alt text on placeholder and image-error elements', async () => {
    const fixture = createHomeFixture();
    const products = [
      makeProduct(1, {
        nameProduct: 'Cubo de Compañía de Portal',
        image: 'productoSinImagen.png',
      }),
      makeProduct(2, {
        nameProduct: 'Busto Darth Vader',
        image: 'vader.webp',
      }),
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, { products }));
    vi.stubGlobal('fetch', fetchMock);

    await initializeHomeCatalog(fixture.document as unknown as Document);

    // S2 picks id 2 (highest id with real photo) for the hero specimen
    const featuredImage = fixture.featuredContent.querySelector('.hero-specimen__image')!;
    expect(featuredImage.alt).toBe('Busto Darth Vader');

    for (const listener of featuredImage.listeners.get('error') ?? []) {
      listener({ target: featuredImage } as unknown as Event);
    }
    expect(featuredImage.alt).toBe('Busto Darth Vader (sin foto disponible)');

    const cards = fixture.productGrid.querySelectorAll('.home-product-card');
    const firstCardImage = cards[0].querySelector('.home-product-card__image')!;
    const secondCardImage = cards[1].querySelector('.home-product-card__image')!;

    expect(firstCardImage.alt).toBe('Cubo de Compañía de Portal (sin foto disponible)');
    expect(secondCardImage.alt).toBe('Busto Darth Vader');

    for (const listener of secondCardImage.listeners.get('error') ?? []) {
      listener({ target: secondCardImage } as unknown as Event);
    }
    expect(secondCardImage.alt).toBe('Busto Darth Vader (sin foto disponible)');
  });

  it('shows sleeping callout with safe wake link and auto-retries once on tab return', async () => {
    const fixture = createHomeFixture();
    const wakeUrl = 'https://mundo-3d-backend.onrender.com/health/ready';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(503, {
          error: 'El servidor gratuito está dormido',
          code: 'BACKEND_SLEEPING',
          wakeUrl,
        }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { products: [PORTAL_CUBE] }));
    vi.stubGlobal('fetch', fetchMock);

    await initializeHomeCatalog(fixture.document as unknown as Document);

    // Sleeping catalog short-circuits without hitting /api/products/latest
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const heroWake = fixture.featuredContent.querySelector('.home-state__wake');
    const catalogWake = fixture.productsState.querySelector('.home-state__wake');
    expect(heroWake?.href).toBe(wakeUrl);
    expect(heroWake?.getAttribute('target')).toBe('_blank');
    expect(heroWake?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(heroWake?.textContent).toBe('Despertar servidor ↗');
    expect(catalogWake?.href).toBe(wakeUrl);
    expect(fixture.productsState.querySelector('.ui-callout__title')?.textContent).toBe(
      'El servidor está dormido',
    );
    expect(fixture.productsState.querySelector('.home-state__retry')?.textContent).toBe(
      'Reintentar',
    );

    // Clicking the wake link arms a one-shot retry when the tab returns to visible
    catalogWake!.click();
    fixture.document.visibilityState = 'hidden';
    fixture.document.dispatchEvent('visibilitychange');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fixture.document.visibilityState = 'visible';
    fixture.document.dispatchEvent('visibilitychange');
    await flushMicrotasks();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fixture.featuredContent.querySelector('.hero-specimen__name')?.textContent).toBe(
      'Cubo de Compañía de Portal',
    );
    expect(fixture.productsState.hidden).toBe(true);
    expect(fixture.productsContent.hidden).toBe(false);

    // Listener was one-shot: subsequent visibility changes do not re-fetch
    fixture.document.dispatchEvent('visibilitychange');
    await flushMicrotasks();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
