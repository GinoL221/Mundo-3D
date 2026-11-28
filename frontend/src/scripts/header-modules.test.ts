import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { initializeCartBadge } from './cartBadge';
import { initializeSessionUI } from './sessionUI';
import { initializeThemeToggle } from './themeToggle';
import { cartItems } from '../domains/cart/services/CartService';

class FakeElement {
  style: Record<string, string> = {};
  attributes = new Map<string, string>();
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

  setAttribute(name: string, value: string) {
    this.attributes.set(name, value);
  }

  getAttribute(name: string) {
    return this.attributes.get(name) ?? null;
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
      'meta[name="color-scheme"]': 'color-scheme-meta',
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
    'color-scheme-meta',
    'navbar-cart-badge',
    'product-link',
    'orders-link',
    'search-button',
  ]) {
    document.elements.set(id, new FakeElement());
  }
  document.elements.get('product-link')!.href = '/products';
  document.elements.get('orders-link')!.href = '/orders';
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

describe('Shared route shell', () => {
  it('uses the Home visual shell and complete navigation contract on non-Home routes', () => {
    const source = (relativePath: string) =>
      readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf8');
    const layout = source('../layouts/Layout.astro');
    const header = source('../components/HomeHeader.astro');
    const footer = source('../components/HomeFooter.astro');
    const headerStyles = source('../styles/components/home-shell.css');
    const brandStyles = source('../styles/components/home-brand.css');
    const homeStyles = source('../styles/components/home.css');
    const productsStyles = source('../styles/components/home-products.css');
    const indexPage = source('../pages/index.astro');
    const colorTokens = source('../styles/tokens/colors.css');
    const baseLayoutStyles = source('../styles/base/layout.css');
    const productCardTemplate = source('../domains/products/components/HomeProductCard.astro');
    const footerStyles = source('../styles/components/home-footer.css');
    const routeSources = [
      '../pages/index.astro',
      '../pages/products.astro',
      '../pages/product.astro',
      '../pages/cart.astro',
    ].map(source);
    const baseStyles = source('../styles/components/home-responsive-base.css');
    const responsiveStyles = source('../styles/components/home-responsive.css');
    const desktopStyles = source('../styles/components/home-responsive-desktop.css');
    const tabletStyles = source('../styles/components/home-responsive-tablet.css');
    const motionStyles = source('../styles/components/home-responsive-motion.css');

    const navTogglesStyles = source('../styles/components/nav-toggles.css');
    const homeCatalogLoaderSource = source('./homeCatalogLoader.ts');

    expect(layout).not.toContain("import Header from '../components/Header.astro'");
    expect(layout).not.toContain("import Footer from '../components/Footer.astro'");
    expect(layout).not.toContain('WhatsAppFloating');
    expect(layout).not.toContain('whatsapp-floating.css');
    expect(layout).not.toContain('variant?:');
    expect(layout).toContain('<body class="home-shell">');
    expect(layout).toContain('<a class="skip-link" href="#main-content">Saltar al contenido</a>');
    expect(layout).toContain('<span id="main-content" class="skip-target" tabindex="-1"></span>');
    expect(layout).toContain('<HomeHeader pathname={Astro.url.pathname} />');
    expect(layout).not.toContain('showUnavailableSearch');
    expect(layout).toContain('<HomeFooter />');
    expect(layout).not.toContain('retro-theme-preference');
    expect(layout).not.toContain('crt-theme-active');
    expect(layout).not.toContain('class="crt-overlay"');
    expect(layout).toContain('<meta name="color-scheme" content="light dark" />');
    expect(layout).toContain('data-theme-preference');
    expect(layout).toContain("? stored : 'system'");
    const homePage = source('../pages/index.astro');
    expect(homePage).not.toContain('variant="home"');
    expect(homePage).not.toContain('home-eyebrow');
    expect(homePage).not.toContain('home-featured-card__label');
    expect(homePage).not.toContain('home-catalogue-intro');
    expect(homePage).toContain('id="catalogo"');
    expect(homePage).toContain(
      '<h1 class="home-hero__title" id="home-hero-title">Piezas impresas para tener cerca</h1>',
    );
    expect(homePage).not.toContain('Piezas impresas para tener cerca.');

    const homeErrorTemplate = homePage.match(
      /<template id="home-error-state-template">[\s\S]*?<\/template>/,
    )?.[0];
    expect(homeErrorTemplate).toContain(
      '<button type="button" class="ui-btn ui-btn--secondary home-state__retry">Reintentar</button>',
    );
    expect(homeErrorTemplate).toContain('<h3 class="ui-callout__title">');

    const homeFeaturedErrorTemplate = homePage.match(
      /<template id="home-featured-error-state-template">[\s\S]*?<\/template>/,
    )?.[0];
    expect(homeFeaturedErrorTemplate).toContain(
      '<button type="button" class="ui-btn ui-btn--secondary home-state__retry">Reintentar</button>',
    );
    expect(homeFeaturedErrorTemplate).toContain('href="/products"');

    const homeEmptyTemplate = homePage.match(
      /<template id="home-empty-state-template">[\s\S]*?<\/template>/,
    )?.[0];
    expect(homeEmptyTemplate).toContain('href="/help"');

    expect(homePage).toContain(
      "import { initializeHomeCatalog } from '../scripts/homeCatalogLoader';",
    );
    expect(homePage).toContain('initializeHomeCatalog(document);');
    expect(homePage).toContain('id="home-products-content"');
    expect(homePage).toContain('id="home-product-grid"');
    expect(homeCatalogLoaderSource).toContain('export function createHomeCatalogLoader');
    expect(homeCatalogLoaderSource).not.toMatch(/contentEl\??\.remove\(\)/);
    expect(homeCatalogLoaderSource).not.toMatch(/loadingMsg\??\.remove\(\)/);

    expect(homeStyles).toMatch(/\.hero-specimen__state \{[\s\S]*?min-height: 180px;/);
    expect(productsStyles).toMatch(/\.home-products__loading \{[\s\S]*?margin: 0;/);
    expect(homeStyles).toMatch(
      /\.home-text-link:focus-visible \{[\s\S]*?outline: 3px solid var\(--home-blue\);/,
    );
    for (const route of routeSources) {
      expect(route).toContain("import Layout from '../layouts/Layout.astro'");
      expect(route).toMatch(/<Layout(?:\s|>)/);
      expect(route).toContain('</Layout>');
    }

    expect(header).toContain('id="navbar-user-menu-trigger"');
    expect(header).toContain('id="navbar-workshop-trigger"');
    expect(header).toContain('aria-expanded="false"');
    expect(header).toContain('aria-controls="navbar-user-menu"');
    expect(header).toContain('aria-controls="navbar-workshop-menu"');
    expect(header).not.toContain('aria-haspopup="menu"');
    expect(header).not.toContain('role="menu"');
    expect(header).not.toContain('role="menuitem"');
    expect(headerStyles).toMatch(
      /\.home-header \.nav-item__dropdown \{[\s\S]*?position: absolute;[\s\S]*?list-style: none;/,
    );
    expect(headerStyles).toMatch(
      /\.home-header \.nav-item__dropdown a \{[\s\S]*?min-height: 44px;/,
    );

    expect(header).toContain('href="/profile"');
    expect(header).toContain('class="home-header__cart-wrap buyer-only"');
    expect(header).toContain('<li class="buyer-only"><a href="/orders">Mis pedidos</a></li>');
    expect(header).not.toContain('href="/#catalogo"');
    expect(header).not.toContain('href="/#encargos"');
    for (const href of [
      '/products',
      '/help',
      '/step-by-step',
      '/login',
      '/register',
      '/orders',
      '/admin/orders',
      '/admin/products',
      '/admin/commission-requests',
      '/cart',
    ]) {
      expect(header).toContain(`href="${href}"`);
    }
    expect(header).toContain('pathname: string;');
    expect(header).toContain('const { pathname } = Astro.props;');
    expect(header).toContain("currentPath.startsWith('/admin/products/')");
    expect(header).toContain(
      "aria-current={adminProductsIsCurrent ? 'page' : adminProductsSectionIsCurrent ? 'true' : undefined}",
    );
    expect(header).not.toContain('theme-toggle-label');
    expect(header).not.toContain('theme-toggle-btn__label');
    expect(header).not.toContain('<span>Carrito</span>');
    expect(header).toContain('aria-label="Carrito de compras"');
    expect(header).toContain('title="Carrito"');
    expect(header).toContain('aria-label="Tema: sistema. Cambiar a tema claro"');
    expect(header).toContain('title="Tema: sistema"');
    expect(navTogglesStyles).not.toContain('theme-toggle-btn__label');
    expect(navTogglesStyles).not.toMatch(/\.theme-toggle-btn__icon svg \{[^}]*display:\s*block;/);
    expect(navTogglesStyles).toContain('.theme-toggle-btn__icon--system {\n  display: block;\n}');
    expect(navTogglesStyles).toContain(
      "html[data-theme-preference='light'] .theme-toggle-btn__icon--sun",
    );
    expect(navTogglesStyles).toContain(
      "html[data-theme-preference='dark'] .theme-toggle-btn__icon--moon",
    );
    expect(headerStyles).not.toContain('theme-toggle-btn__label');
    expect(headerStyles).not.toMatch(/@media \(min-width: 1024px\) \{[\s\S]*?\.home-header__theme/);
    expect(header).not.toContain('showUnavailableSearch');
    expect(header).not.toContain('home-header__search');
    expect(header).not.toContain('Búsqueda próximamente');
    expect(header).not.toContain('home-search-availability');
    expect(header).not.toContain('La búsqueda todavía no está disponible');
    expect(header).toContain("aria-current={productsIsCurrent ? 'page' : undefined}");
    expect(header).toContain("aria-current={helpIsCurrent ? 'page' : undefined}");
    expect(header).toContain("aria-current={stepByStepIsCurrent ? 'page' : undefined}");
    expect(header).toContain('>Catálogo</a>');
    expect(header).toContain('>Encargos</a>');
    expect(header).toContain('>Cómo funciona</a>');
    expect(header).toContain('<span>Taller</span>');
    expect(header).toContain('Pedidos');
    expect(header).toContain('Catálogo y stock');
    expect(header).toContain('Solicitudes recibidas');
    expect(header).not.toContain('Administrar productos');
    expect(header).not.toContain('Solicitudes de encargo');
    expect(header).toContain('>Ver el catálogo</a>');
    expect(header).not.toContain('>Encargos y ayuda</a>');
    expect(header).not.toContain('Guía de compra');

    expect(responsiveStyles).toMatch(
      /^@import '.\/home-responsive-base\.css';\n@import '.\/home-responsive-desktop\.css';\n@import '.\/home-responsive-tablet\.css';\n@import '.\/home-responsive-motion\.css';/,
    );
    expect(responsiveStyles).not.toContain('.home-header__search');
    expect(responsiveStyles).toContain('@media (min-width: 1024px)');
    expect(responsiveStyles).toContain('@media (min-width: 1200px)');
    expect(responsiveStyles).not.toContain('.home-header__cart > span:not(.cart-link__badge)');
    expect(productCardTemplate).not.toContain('src=""');
    expect(homeStyles).not.toContain('image-rendering: pixelated');
    expect(productsStyles).not.toContain('image-rendering: pixelated');
    const retiredToken = ['--home', 'line', 'hover'].join('-');
    expect(colorTokens).toContain('--border-hover: #cbd5e1;');
    expect(colorTokens).toContain('--border-hover: #46403a;');
    expect(headerStyles).not.toContain(retiredToken);
    expect(headerStyles).toContain('border-color: var(--border-hover);');
    expect(brandStyles).toContain('--home-line: var(--border);');
    expect(brandStyles).not.toContain(retiredToken);
    expect(productsStyles).toContain('border-color: var(--border-hover);');
    expect(productsStyles).toMatch(
      /\.home-product-card \{[\s\S]*?border-radius: var\(--radius-surface\);/,
    );
    expect(homeStyles).toMatch(
      /\.hero-specimen__media \{[\s\S]*?border-radius: var\(--radius-surface\);/,
    );
    expect(productsStyles).toMatch(/\.home-product-card__footer \{[\s\S]*?align-items: baseline;/);
    expect(productsStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.home-product-card__image/,
    );
    expect(productsStyles).toMatch(
      /\.home-product-card__price \{[\s\S]*?font-variant-numeric: tabular-nums;/,
    );
    expect(homeStyles).toMatch(
      /\.hero-specimen__price \{[\s\S]*?font-variant-numeric: tabular-nums;/,
    );
    expect(baseLayoutStyles).toContain('::selection');
    expect(baseLayoutStyles).toContain('.skip-link');
    expect(baseLayoutStyles).toContain('accent-color: var(--accent);');
    expect(baseLayoutStyles).toContain('scrollbar-color: var(--border) var(--bg);');
    expect(baseLayoutStyles).toContain('text-underline-offset: 0.2em;');
    expect(baseLayoutStyles).not.toContain('scrollbar-width: thin');
    expect(desktopStyles).toContain('@media (min-width: 1024px)');
    expect(desktopStyles).not.toContain('@media (min-width: 640px)');
    expect(desktopStyles).not.toContain('prefers-reduced-motion');
    expect(tabletStyles).toContain('@media (min-width: 768px) and (max-width: 1023px)');
    expect(tabletStyles).toContain('@media (max-width: 360px)');
    expect(tabletStyles).not.toContain('@media (min-width: 1024px)');
    expect(tabletStyles).not.toContain('prefers-reduced-motion');
    expect(motionStyles).toContain('@media (prefers-reduced-motion: reduce)');
    expect(motionStyles).not.toContain('@media (min-width:');
    expect(motionStyles).not.toContain('@media (max-width:');

    const footerLinks = [
      ['Catálogo', '/products'],
      ['Encargos', '/help'],
      ['Cómo funciona', '/step-by-step'],
      ['Preguntas frecuentes', '/faq'],
      ['Nosotros', '/aboutUs'],
      ['Términos', '/terms'],
      ['Privacidad', '/privacy'],
    ] as const;
    for (const [label, href] of footerLinks) {
      expect(footer).toContain(`<a href="${href}">${label}</a>`);
    }
    for (const heading of ['Tienda', 'Información', 'Proyecto']) {
      expect(footer).toContain(`<p class="home-footer__col-title">${heading}</p>`);
    }
    expect(footer).not.toContain('<h2 class="home-footer__col-title">');
    expect(footer).toContain('<nav class="home-footer__columns" aria-label="Navegación del pie">');
    expect(
      footer
        .match(/<nav class="home-footer__columns"[\s\S]*?<\/nav>/)?.[0]
        .match(/<a[\s\S]*?href="/g),
    ).toHaveLength(9);
    expect(footer).not.toContain('openspec');
    expect(footer).not.toContain('instagram.com');
    expect(footer).not.toContain('x.com');
    expect(footer).not.toContain('tiktok.com');
    expect(footer).toContain('href="https://github.com/GinoL221/Mundo-3D"');
    expect(footer).toContain('<SocialIcon name="github"');
    expect(footer).not.toContain('home-footer__tagline');
    expect(footer).not.toContain('home-footer__heading');
    expect(footer).toContain('id="ayuda"');
    expect(footer).toContain('<div class="home-footer__bottom">');
    expect(footer).toContain('Código fuente en GitHub');
    expect(footer).toContain(
      'Mundo 3D · Proyecto de portfolio (demo interactiva, sin operación comercial real).',
    );

    expect(headerStyles).toMatch(
      /\.home-header \.cart-link__badge \{[^}]*?background: var\(--sys-action-bg\);/,
    );
    expect(baseLayoutStyles).toMatch(
      /\[data-theme='dark'\] ::selection \{[^}]*?background: var\(--sys-action-bg\);/,
    );
    for (const styles of [homeStyles, headerStyles, productsStyles, baseLayoutStyles]) {
      expect(styles).not.toContain('var(--sys-action-bg,');
    }
    const commissionBlock = productsStyles.match(/\.home-commission \{[^}]*\}/)?.[0] ?? '';
    expect(commissionBlock).toContain('border-top: 1px solid var(--border);');
    expect(commissionBlock).not.toContain('background');
    expect(commissionBlock).not.toContain('accent-tint');
    expect(productsStyles).toMatch(/\.home-commission__title \{[^}]*?color: var\(--fg\);/);
    expect(productsStyles).toMatch(
      /\.home-commission__description \{[^}]*?max-width: 60ch;[^}]*?color: var\(--sys-text-muted\);/,
    );
    expect(indexPage).toContain(
      '<a class="ui-btn ui-btn--primary home-commission__cta" href="/help">',
    );
    expect(header).toContain(
      '<div class="home-header__primary" id="home-primary-navigation" hidden>',
    );
    expect(header).toContain('<nav class="home-header__nav" aria-label="Navegación principal">');
    expect(header).toContain('class="home-header__link home-header__register" href="/register"');
    expect(header).not.toContain('home-header__account-heading');
    expect(header).not.toContain('>Cuenta<');
    expect(header.indexOf('class="home-header__logo"')).toBeLessThan(
      header.indexOf('id="home-primary-navigation"'),
    );
    expect(header.indexOf('id="home-primary-navigation"')).toBeLessThan(
      header.indexOf('id="navbar-cart-trigger"'),
    );
    expect(header.indexOf('id="navbar-cart-trigger"')).toBeLessThan(
      header.indexOf('href="/login"'),
    );
    expect(header.indexOf('href="/register"')).toBeLessThan(header.indexOf('id="theme-toggle"'));
    expect(headerStyles).toMatch(
      /\.home-header \{[^}]*?border-bottom: 1px solid var\(--home-brand-line\);/,
    );
    expect(headerStyles).toContain('.home-header__logo:focus-visible');
    expect(baseStyles).toContain('.home-header__nav + .home-header__account-section');
    expect(baseStyles).not.toContain('border-inline-start: 1px solid var(--home-brand-line)');
    expect(baseStyles).not.toContain('border-inline-start: 3px solid');
    expect(baseStyles).toMatch(
      /\.home-header__nav > ul > li > \.home-header__link--active \{[^}]*?background: var\(--accent-tint\);[^}]*?color: var\(--accent-tint-text\);/,
    );
    expect(desktopStyles).toMatch(
      /\.home-header__nav > ul > li > \.home-header__link--active \{[^}]*?text-decoration: underline;/,
    );
    expect(desktopStyles).not.toContain('position: absolute');
    expect(desktopStyles).not.toMatch(/\border:\s*\d+/);
    expect(desktopStyles).toMatch(
      /\.home-header__inner \{[^}]*?display: grid;[^}]*?grid-template-columns: minmax\(140px, 1fr\) auto minmax\(max-content, 1fr\);/,
    );
    expect(desktopStyles).toMatch(
      /\.home-header__inner:has\(\.user-only\[style\*='display: block'\]\) \.home-header__account-section \{[^}]*?display: none;/,
    );
    expect(desktopStyles).toMatch(
      /\.home-header__inner:not\(:has\(\.user-only\[style\*='display: block'\]\)\) \.home-header__account \{[^}]*?display: none;/,
    );
    expect(header).toContain('id="navbar-cart-trigger"');
    expect(header).toContain('id="navbar-cart-menu"');
    expect(header).toContain('initializeMiniCart(document)');
    expect(headerStyles).toMatch(/\.mini-cart \{/);
    expect(headerStyles).toMatch(
      /\.home-header \.cart-link__badge \{[\s\S]*?font-size: var\(--text-xs\);/,
    );
    expect(desktopStyles).toMatch(
      /\.home-header__account-section,\s*\.home-header__account \{[^}]*?margin-inline-start: 14px;[^}]*?padding-inline-start: 14px;[^}]*?border-inline-start: 1px solid var\(--home-brand-line\);/,
    );
    expect(desktopStyles).toMatch(/\.home-header__theme \{[^}]*?margin-inline-start: 10px;/);
    expect(desktopStyles).toMatch(
      /\.home-header__account-section \.home-header__register \{[^}]*?border: 1px solid var\(--border\);[^}]*?border-radius: var\(--radius-control\);[^}]*?background: var\(--surface\);[^}]*?color: var\(--fg\);/,
    );

    expect(footerStyles).toContain('@media (min-width: 640px)');
    expect(footerStyles).toContain('@media (min-width: 1024px)');
    expect(footerStyles).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(footerStyles).toContain(
      'grid-template-columns: minmax(220px, 1.4fr) repeat(3, minmax(0, 1fr))',
    );
    expect(footerStyles).toMatch(
      /\.home-footer__links a \{[\s\S]*?min-width: 44px;[\s\S]*?min-height: 44px;[\s\S]*?box-sizing: border-box;[\s\S]*?\}/,
    );
  });
});

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

    // A BroadcastChannel login message from another tab (e.g. that tab
    // logging out and back in as staff) re-reads the cookie the same way.
    // The logout direction deliberately does NOT — see sessionUI.test.ts,
    // which owns the message-payload contract.
    setUserCookie(document, { firstName: 'User', idRole: 3 });
    const channel = FakeBroadcastChannel.instances.at(-1)!;
    channel.onmessage?.({
      data: { type: 'session-changed', state: 'logged-in' },
    } as MessageEvent);
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
    expect(document.elements.get('orders-link')!.href).toBe('/orders');

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
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(
      fetchMock.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('/api/users/logout'),
      ),
    ).toBe(true);
    expect(
      fetchMock.mock.calls.some(
        (call) => typeof call[0] === 'string' && call[0].includes('/api/users/refresh/revoke'),
      ),
    ).toBe(true);
  });

  it('closes the BroadcastChannel and removes all listeners on cleanup', () => {
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    const fixture = createFixture();
    const { document, window } = fixture;

    const cleanup = initializeSessionUI(
      document as unknown as Document,
      window as unknown as Window,
    );
    const channel = FakeBroadcastChannel.instances.at(-1)!;

    cleanup();

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(window.listeners.has('session-changed')).toBe(false);
    expect(window.listeners.has('focus')).toBe(false);
    expect(document.listeners.has('visibilitychange')).toBe(false);
  });

  it('falls back to system for an invalid persisted theme and supports safe matchMedia absence', () => {
    const fixture = createFixture();
    fixture.storage.setItem('theme', 'invalid');
    const cleanup = initializeThemeToggle(
      fixture.document as unknown as Document,
      fixture.storage as unknown as Storage,
    );
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('system');
    expect(fixture.document.elements.get('color-scheme-meta')!.getAttribute('content')).toBe(
      'light dark',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: sistema (actualmente claro). Cambiar a tema claro',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: sistema (claro)',
    );
    expect(fixture.document.elements.get('theme-icon')!.textContent).toBe('');

    expect(
      initializeThemeToggle(
        fixture.document as unknown as Document,
        fixture.storage as unknown as Storage,
      ),
    ).toBe(cleanup);

    fixture.document.elements.get('theme-toggle')!.click();
    expect(fixture.storage.setItem).toHaveBeenCalledWith('theme', 'light');
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('light');
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: claro',
    );

    fixture.document.elements.get('theme-toggle')!.click();
    expect(fixture.storage.setItem).toHaveBeenCalledWith('theme', 'dark');
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('dark');
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: oscuro',
    );

    cleanup();
    cleanup();
  });

  it('cycles system -> light -> dark -> system, reacts to matchMedia in system mode, and cleans up listeners', () => {
    const mediaListeners = new Set<(event: MediaQueryListEvent) => void>();
    const mediaQueryList = {
      matches: true,
      addEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') mediaListeners.add(listener);
      }),
      removeEventListener: vi.fn((type: string, listener: (event: MediaQueryListEvent) => void) => {
        if (type === 'change') mediaListeners.delete(listener);
      }),
    };

    const fixture = createFixture();
    Object.assign(fixture.window, {
      matchMedia: vi.fn(() => mediaQueryList),
    });

    const cleanup = initializeThemeToggle(
      fixture.document as unknown as Document,
      fixture.storage as unknown as Storage,
    );

    // Absent theme starts at system (currently dark via matchMedia.matches = true)
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('system');
    expect(fixture.document.elements.get('color-scheme-meta')!.getAttribute('content')).toBe(
      'light dark',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: sistema (actualmente oscuro). Cambiar a tema claro',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: sistema (oscuro)',
    );
    expect(fixture.document.elements.get('theme-icon')!.textContent).toBe('');

    // Live matchMedia change while in system mode -> light
    mediaQueryList.matches = false;
    for (const listener of mediaListeners) {
      listener({ matches: false } as MediaQueryListEvent);
    }
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('system');
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: sistema (actualmente claro). Cambiar a tema claro',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: sistema (claro)',
    );

    // Click 1: system -> light
    fixture.document.elements.get('theme-toggle')!.click();
    expect(fixture.storage.getItem('theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('light');
    expect(fixture.document.elements.get('color-scheme-meta')!.getAttribute('content')).toBe(
      'light',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: claro. Cambiar a tema oscuro',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: claro',
    );
    expect(fixture.document.elements.get('theme-icon')!.textContent).toBe('');

    // System media change does not override explicit light preference
    mediaQueryList.matches = true;
    for (const listener of mediaListeners) {
      listener({ matches: true } as MediaQueryListEvent);
    }
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('light');

    // Click 2: light -> dark
    fixture.document.elements.get('theme-toggle')!.click();
    expect(fixture.storage.getItem('theme')).toBe('dark');
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('dark');
    expect(fixture.document.elements.get('color-scheme-meta')!.getAttribute('content')).toBe(
      'dark',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: oscuro. Cambiar a tema del sistema',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: oscuro',
    );
    expect(fixture.document.elements.get('theme-icon')!.textContent).toBe('');

    // Click 3: dark -> system (currently dark via matchMedia.matches = true)
    fixture.document.elements.get('theme-toggle')!.click();
    expect(fixture.storage.getItem('theme')).toBe('system');
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('system');
    expect(fixture.document.elements.get('color-scheme-meta')!.getAttribute('content')).toBe(
      'light dark',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: sistema (actualmente oscuro). Cambiar a tema claro',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: sistema (oscuro)',
    );

    // Cleanup removes both button click and matchMedia change listeners
    expect(mediaListeners.size).toBe(1);
    cleanup();
    expect(mediaQueryList.removeEventListener).toHaveBeenCalledTimes(1);
    expect(mediaListeners.size).toBe(0);
    expect(fixture.document.elements.get('theme-toggle')!.listeners.has('click')).toBe(false);
  });

  it('handles blocked or failing storage getItem and setItem without throwing', () => {
    const fixture = createFixture();
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new Error('SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: vi.fn(),
    };

    let cleanup: (() => void) | undefined;
    expect(() => {
      cleanup = initializeThemeToggle(
        fixture.document as unknown as Document,
        throwingStorage as unknown as Storage,
      );
    }).not.toThrow();

    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('system');
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: sistema (claro)',
    );

    expect(() => fixture.document.elements.get('theme-toggle')!.click()).not.toThrow();
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('light');
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: claro. Cambiar a tema oscuro',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: claro',
    );

    expect(() => fixture.document.elements.get('theme-toggle')!.click()).not.toThrow();
    expect(fixture.document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('dark');
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('aria-label')).toBe(
      'Tema: oscuro. Cambiar a tema del sistema',
    );
    expect(fixture.document.elements.get('theme-toggle')!.getAttribute('title')).toBe(
      'Tema: oscuro',
    );

    expect(() => fixture.document.elements.get('theme-toggle')!.click()).not.toThrow();
    expect(fixture.document.documentElement.getAttribute('data-theme-preference')).toBe('system');

    cleanup?.();
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
