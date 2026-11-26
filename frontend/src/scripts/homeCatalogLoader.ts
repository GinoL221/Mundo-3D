import {
  getCategoryImg,
  isPlaceholderImage,
  type Product,
} from '../domains/products/adapters/product.adapter';
import { resolveImageUrl } from '../lib/imageUrl';
import {
  fetchFeaturedProduct,
  fetchProducts,
  selectLatestPhotoProduct,
  type FetchProductsResult,
} from '../domains/products/services/product.service';

const formatPrice = (price: number): string => `$ ${new Intl.NumberFormat('es-AR').format(price)}`;

function formatSpecimenDimensions(product: Product): string | null {
  if (!product.hasDimensions) return null;
  const parts = [product.height, product.width, product.depth].filter(
    (value) => value && value !== 'no definida' && value !== 'A consultar',
  );
  if (parts.length === 0) return null;
  if (parts.every((part) => part.endsWith(' cm'))) {
    return `${parts.map((part) => part.slice(0, -3)).join(' × ')} cm`;
  }
  return parts.join(' × ');
}

function setSpecCell(
  container: ParentNode,
  selector: string,
  value: string | null,
): boolean {
  const cell = container.querySelector<HTMLElement>(selector);
  if (!cell) return false;
  if (!value) {
    cell.hidden = true;
    cell.remove();
    return false;
  }
  const dd = cell.querySelector('dd');
  if (dd) dd.textContent = value;
  return true;
}

export interface HomeCatalogLoader {
  load: () => Promise<void>;
}

export function createHomeCatalogLoader(document: Document): HomeCatalogLoader {
  let activeAttempt = 0;
  let retryOnVisibleArmed = false;

  const armRetryOnVisible = (): void => {
    if (retryOnVisibleArmed || typeof document.addEventListener !== 'function') return;
    retryOnVisibleArmed = true;
    const handleVisibilityChange = (): void => {
      if (document.visibilityState !== 'visible') return;
      retryOnVisibleArmed = false;
      if (typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      void loadHomeCatalog();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
  };

  const applySleepingCallout = (
    root: ParentNode,
    wakeUrl: string | null,
    isFeatured = false,
  ): void => {
    const title = root.querySelector<HTMLElement>('.ui-callout__title');
    const text = root.querySelector<HTMLElement>('.ui-callout__text');
    if (title) title.textContent = 'El servidor está dormido';
    if (text) {
      text.textContent = isFeatured
        ? 'El backend gratuito se pausa tras 15 min sin uso (tarda ~30–60 s en despertar).'
        : 'El backend gratuito se pausa tras 15 min sin uso (tarda ~30–60 s en despertar). Abrilo para reactivarlo y después volvé acá.';
    }

    if (!wakeUrl) return;
    const actions = root.querySelector<HTMLElement>('.ui-callout__actions');
    if (!actions) return;

    const wakeLink = document.createElement('a');
    wakeLink.className = 'ui-btn ui-btn--primary home-state__wake';
    wakeLink.href = wakeUrl;
    wakeLink.setAttribute('target', '_blank');
    wakeLink.setAttribute('rel', 'noopener noreferrer');
    wakeLink.textContent = 'Despertar servidor ↗';
    wakeLink.addEventListener('click', () => {
      armRetryOnVisible();
    });

    const existing = Array.from(actions.children);
    actions.replaceChildren(wakeLink, ...existing);
  };

  const wireRetryButton = (root: ParentNode): void => {
    const retryButton = root.querySelector<HTMLButtonElement>('.home-state__retry');
    if (!retryButton) return;
    retryButton.addEventListener('click', () => {
      retryButton.disabled = true;
      void loadHomeCatalog();
    });
  };

  const restoreFeaturedLoadingState = (): void => {
    const content = document.getElementById('home-featured-content');
    if (!content || document.getElementById('home-featured-loading')) return;

    const loading = document.createElement('div');
    loading.className = 'hero-specimen__skeleton';
    loading.id = 'home-featured-loading';
    loading.setAttribute('role', 'status');
    loading.setAttribute('aria-busy', 'true');

    const media = document.createElement('span');
    media.className = 'hero-specimen__skeleton-media ui-skeleton';
    media.setAttribute('aria-hidden', 'true');

    const sheet = document.createElement('div');
    sheet.className = 'hero-specimen__skeleton-sheet';
    sheet.setAttribute('aria-hidden', 'true');

    const line1 = document.createElement('span');
    line1.className = 'ui-skeleton ui-skeleton--medium';
    const line2 = document.createElement('span');
    line2.className = 'ui-skeleton';
    const line3 = document.createElement('span');
    line3.className = 'ui-skeleton ui-skeleton--short';
    sheet.append(line1, line2, line3);

    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = 'Cargando pieza destacada…';

    loading.append(media, sheet, sr);
    content.replaceChildren(loading);
  };

  const restoreProductsLoadingState = (): void => {
    const loadingMsg = document.getElementById('home-loading-msg');
    const stateEl = document.getElementById('home-products-state');
    const contentEl = document.getElementById('home-products-content');
    if (loadingMsg) loadingMsg.hidden = false;
    if (stateEl) {
      stateEl.replaceChildren();
      stateEl.hidden = true;
    }
    if (contentEl) contentEl.hidden = true;
  };

  const loadFeaturedProduct = async (
    productsResultPromise: Promise<FetchProductsResult>,
    attempt: number,
  ): Promise<void> => {
    const content = document.getElementById('home-featured-content');
    const template = document.getElementById(
      'home-featured-product-template',
    ) as HTMLTemplateElement | null;
    if (!content || !template) return;

    const isCatalogAvailable = async (): Promise<boolean> => {
      try {
        const catalogResult = await productsResultPromise;
        return catalogResult.ok;
      } catch {
        return false;
      }
    };

    const showState = (
      id: string,
      suppressRetry = false,
      sleeping?: { wakeUrl: string | null },
    ): void => {
      const stateTemplate = document.getElementById(id) as HTMLTemplateElement | null;
      if (!stateTemplate) return;
      const clone = stateTemplate.content.cloneNode(true) as DocumentFragment;
      if (suppressRetry) {
        const retryButton = clone.querySelector<HTMLButtonElement>('.home-state__retry');
        if (retryButton) {
          retryButton.hidden = true;
          retryButton.remove();
        }
      } else {
        wireRetryButton(clone);
      }
      if (sleeping) {
        applySleepingCallout(clone, sleeping.wakeUrl, true);
      }
      content.replaceChildren(clone);
    };

    let result: Awaited<ReturnType<typeof fetchFeaturedProduct>>;
    try {
      result = await fetchFeaturedProduct(productsResultPromise);
    } catch {
      if (attempt !== activeAttempt) return;
      const catalogOk = await isCatalogAvailable();
      if (attempt !== activeAttempt) return;
      showState('home-featured-error-state-template', !catalogOk);
      return;
    }

    if (attempt !== activeAttempt) return;

    if (!result.ok) {
      if ('reason' in result && result.reason === 'not-found') {
        showState('home-featured-empty-state-template');
      } else if (result.reason === 'sleeping') {
        const catalogOk = await isCatalogAvailable();
        if (attempt !== activeAttempt) return;
        showState('home-featured-error-state-template', !catalogOk, { wakeUrl: result.wakeUrl });
      } else {
        const catalogOk = await isCatalogAvailable();
        if (attempt !== activeAttempt) return;
        showState('home-featured-error-state-template', !catalogOk);
      }
      return;
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const mediaLink = clone.querySelector<HTMLAnchorElement>('.hero-specimen__media');
    const image = clone.querySelector<HTMLImageElement>('.hero-specimen__image');
    const name = clone.querySelector<HTMLElement>('.hero-specimen__name');
    const price = clone.querySelector<HTMLElement>('.hero-specimen__price');
    const specsList = clone.querySelector<HTMLElement>('.hero-specimen__specs');
    const ctaLink = clone.querySelector<HTMLAnchorElement>('.hero-specimen__cta');
    const product = result.product;
    const productUrl = `/product?id=${product.id}`;

    if (mediaLink) mediaLink.href = productUrl;
    if (image) {
      if (isPlaceholderImage(product.image)) {
        image.src = `/images/illustrations/${getCategoryImg(product.category)}.svg`;
        image.alt = `${product.name} (sin foto disponible)`;
        image.classList.add('hero-specimen__image--placeholder');
      } else {
        image.src = resolveImageUrl(product.image, 'products');
        image.alt = product.name;
      }
      image.addEventListener('error', () => {
        if (image.dataset.fallback) return;
        image.dataset.fallback = 'true';
        image.src = `/images/illustrations/${getCategoryImg(product.category)}.svg`;
        image.alt = `${product.name} (sin foto disponible)`;
        image.classList.add('hero-specimen__image--placeholder');
      });
    }
    if (name) name.textContent = product.name;
    if (price) price.textContent = formatPrice(product.price);
    if (ctaLink) {
      ctaLink.href = productUrl;
      ctaLink.setAttribute('aria-label', `Ver la pieza: ${product.name}`);
    }

    if (specsList) {
      const categoryValue = product.category ? product.category.trim() : null;
      const materialValue =
        product.material && product.material !== 'A consultar' ? product.material.trim() : null;
      const dimensionsValue = formatSpecimenDimensions(product);

      const visibleSpecs = [
        setSpecCell(specsList, '.hero-specimen__spec--category', categoryValue || null),
        setSpecCell(specsList, '.hero-specimen__spec--material', materialValue),
        setSpecCell(specsList, '.hero-specimen__spec--dimensions', dimensionsValue),
      ].filter(Boolean);

      if (visibleSpecs.length === 0) {
        specsList.hidden = true;
        specsList.remove();
      }
    }

    content.replaceChildren(clone);
  };

  const loadProducts = async (
    productsResultPromise: Promise<FetchProductsResult>,
    attempt: number,
  ): Promise<void> => {
    const loadingMsg = document.getElementById('home-loading-msg');
    const stateEl = document.getElementById('home-products-state');
    const contentEl = document.getElementById('home-products-content');
    const gridContainer = document.getElementById('home-product-grid');
    if (!stateEl || !contentEl || !gridContainer) return;

    const showState = (id: string, sleeping?: { wakeUrl: string | null }): void => {
      if (loadingMsg) loadingMsg.hidden = true;
      contentEl.hidden = true;
      const template = document.getElementById(id) as HTMLTemplateElement | null;
      if (!template) return;
      const clone = template.content.cloneNode(true) as DocumentFragment;
      wireRetryButton(clone);
      if (sleeping) {
        applySleepingCallout(clone, sleeping.wakeUrl, false);
      }
      stateEl.replaceChildren(clone);
      stateEl.hidden = false;
    };

    let result: FetchProductsResult;
    try {
      result = await productsResultPromise;
    } catch {
      if (attempt !== activeAttempt) return;
      showState('home-error-state-template');
      return;
    }

    if (attempt !== activeAttempt) return;

    if (!result.ok) {
      if (result.reason === 'sleeping') {
        showState('home-error-state-template', { wakeUrl: result.wakeUrl });
      } else {
        showState('home-error-state-template');
      }
      return;
    }

    if (result.products.length === 0) {
      showState('home-empty-state-template');
      return;
    }

    const cardTemp = document.getElementById(
      'home-product-card-template',
    ) as HTMLTemplateElement | null;
    if (!cardTemp) return;

    const featuredId = selectLatestPhotoProduct(result.products)?.id;
    const candidateProducts =
      result.products.length > 6 && featuredId != null
        ? result.products.filter((product) => product.id !== featuredId)
        : result.products;
    const products = candidateProducts.slice(0, 6);

    const fragment = document.createDocumentFragment();
    for (const product of products) {
      const clone = cardTemp.content.cloneNode(true) as DocumentFragment;
      const catImg = getCategoryImg(product.category);
      const link = clone.querySelector<HTMLAnchorElement>('.home-product-card__link');
      const img = clone.querySelector<HTMLImageElement>('.home-product-card__image');
      const category = clone.querySelector<HTMLElement>('.home-product-card__category');
      const name = clone.querySelector<HTMLElement>('.home-product-card__name');
      const price = clone.querySelector<HTMLElement>('.home-product-card__price');

      if (link) {
        link.href = `/product?id=${product.id}`;
        link.setAttribute('aria-label', `${product.name} — ${formatPrice(product.price)}`);
      }
      if (img) {
        if (isPlaceholderImage(product.image)) {
          img.src = `/images/illustrations/${catImg}.svg`;
          img.alt = `${product.name} (sin foto disponible)`;
          img.classList.add('home-product-card__image--placeholder');
        } else {
          img.src = resolveImageUrl(product.image, 'products');
          img.alt = product.name;
        }
        img.addEventListener('error', () => {
          if (img.dataset.fallback) return;
          img.dataset.fallback = 'true';
          img.src = '/images/illustrations/Otras.svg';
          img.alt = `${product.name} (sin foto disponible)`;
          img.classList.add('home-product-card__image--placeholder');
        });
      }
      if (category) category.textContent = product.category ? product.category.trim() : '';
      if (name) name.textContent = product.name;
      if (price) price.textContent = formatPrice(product.price);
      fragment.appendChild(clone);
    }

    if (loadingMsg) loadingMsg.hidden = true;
    stateEl.replaceChildren();
    stateEl.hidden = true;
    gridContainer.replaceChildren(fragment);
    contentEl.hidden = false;
  };

  const loadHomeCatalog = async (): Promise<void> => {
    activeAttempt += 1;
    const attempt = activeAttempt;
    const productsResultPromise = fetchProducts();

    restoreFeaturedLoadingState();
    restoreProductsLoadingState();

    await Promise.all([
      loadFeaturedProduct(productsResultPromise, attempt),
      loadProducts(productsResultPromise, attempt),
    ]);
  };

  return {
    load: loadHomeCatalog,
  };
}

export function initializeHomeCatalog(document: Document): Promise<void> {
  return createHomeCatalogLoader(document).load();
}
