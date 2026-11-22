import { getCategoryImg, isPlaceholderImage } from '../domains/products/adapters/product.adapter';
import { resolveImageUrl } from '../lib/imageUrl';
import {
  fetchFeaturedProduct,
  fetchProducts,
  type FetchProductsResult,
} from '../domains/products/services/product.service';

const formatPrice = (price: number): string => `$ ${new Intl.NumberFormat('es-AR').format(price)}`;

export interface HomeCatalogLoader {
  load: () => Promise<void>;
}

export function createHomeCatalogLoader(document: Document): HomeCatalogLoader {
  let activeAttempt = 0;

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
    const loading = document.createElement('p');
    loading.className = 'home-featured-card__state';
    loading.id = 'home-featured-loading';
    loading.setAttribute('role', 'status');
    loading.textContent = 'Cargando pieza destacada…';
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

    const showState = (id: string): void => {
      const stateTemplate = document.getElementById(id) as HTMLTemplateElement | null;
      if (!stateTemplate) return;
      const clone = stateTemplate.content.cloneNode(true) as DocumentFragment;
      wireRetryButton(clone);
      content.replaceChildren(clone);
    };

    let result: Awaited<ReturnType<typeof fetchFeaturedProduct>>;
    try {
      result = await fetchFeaturedProduct(productsResultPromise);
    } catch {
      if (attempt !== activeAttempt) return;
      showState('home-featured-error-state-template');
      return;
    }

    if (attempt !== activeAttempt) return;

    if (!result.ok) {
      showState(
        result.reason === 'not-found'
          ? 'home-featured-empty-state-template'
          : 'home-featured-error-state-template',
      );
      return;
    }

    const clone = template.content.cloneNode(true) as DocumentFragment;
    const link = clone.querySelector<HTMLAnchorElement>('.home-featured-card__link');
    const image = clone.querySelector<HTMLImageElement>('.home-featured-card__image');
    const name = clone.querySelector<HTMLElement>('.home-featured-card__name');
    const price = clone.querySelector<HTMLElement>('.home-featured-card__price');
    const product = result.product;

    if (link) link.href = `/product?id=${product.id}`;
    if (image) {
      if (isPlaceholderImage(product.image)) {
        image.src = `/images/illustrations/${getCategoryImg(product.category)}.svg`;
        image.alt = `${product.name} (sin foto disponible)`;
        image.classList.add('home-featured-card__image--placeholder');
      } else {
        image.src = resolveImageUrl(product.image, 'products');
        image.alt = product.name;
      }
      image.addEventListener('error', () => {
        if (image.dataset.fallback) return;
        image.dataset.fallback = 'true';
        image.src = `/images/illustrations/${getCategoryImg(product.category)}.svg`;
        image.alt = `${product.name} (sin foto disponible)`;
        image.classList.add('home-featured-card__image--placeholder');
      });
    }
    if (name) name.textContent = product.name;
    if (price) price.textContent = formatPrice(product.price);
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

    const showState = (id: string): void => {
      if (loadingMsg) loadingMsg.hidden = true;
      contentEl.hidden = true;
      const template = document.getElementById(id) as HTMLTemplateElement | null;
      if (!template) return;
      const clone = template.content.cloneNode(true) as DocumentFragment;
      wireRetryButton(clone);
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
      showState('home-error-state-template');
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

    const products = result.products.slice(0, 6);

    const fragment = document.createDocumentFragment();
    for (const product of products) {
      const clone = cardTemp.content.cloneNode(true) as DocumentFragment;
      const catImg = getCategoryImg(product.category);
      const link = clone.querySelector<HTMLAnchorElement>('.home-product-card__link');
      const img = clone.querySelector<HTMLImageElement>('.home-product-card__image');
      const category = clone.querySelector<HTMLElement>('.home-product-card__category');
      const name = clone.querySelector<HTMLElement>('.home-product-card__name');
      const price = clone.querySelector<HTMLElement>('.home-product-card__price');

      if (link) link.href = `/product?id=${product.id}`;
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
