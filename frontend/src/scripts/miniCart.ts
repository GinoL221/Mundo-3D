import { cartItems, CartService, type CartItem } from '../domains/cart/services/CartService';
import { isPlaceholderImage } from '../domains/products/adapters/product.adapter';
import { resolveImageUrl } from '../lib/imageUrl';

type Cleanup = () => void;

const cleanups = new WeakMap<Document, Cleanup>();
const SVG_NS = 'http://www.w3.org/2000/svg';
const priceFormatter = new Intl.NumberFormat('es-AR');

function formatPrice(value: number): string {
  return `$ ${priceFormatter.format(value)}`;
}

function createSvgElement(document: Document, tag: string): Element {
  return typeof document.createElementNS === 'function'
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
}

function createRemoveIcon(document: Document): Element {
  const svg = createSvgElement(document, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');

  const path = createSvgElement(document, 'path');
  path.setAttribute('d', 'M18 6 6 18M6 6l12 12');
  svg.appendChild(path);
  return svg;
}

function createPlaceholderThumb(document: Document): HTMLSpanElement {
  const box = document.createElement('span');
  box.className = 'mini-cart__thumb mini-cart__thumb--placeholder';
  box.setAttribute('aria-hidden', 'true');

  const svg = createSvgElement(document, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const cube = createSvgElement(document, 'path');
  cube.setAttribute(
    'd',
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
  );
  const fold = createSvgElement(document, 'path');
  fold.setAttribute('d', 'm3.3 7 8.7 5 8.7-5M12 22V12');
  svg.appendChild(cube);
  svg.appendChild(fold);
  box.appendChild(svg);
  return box;
}

const PRODUCTS_IMG_PREFIX = '/img/products/';
const LEGACY_ILLUSTRATIONS_PREFIX = '/images/illustrations/';

function resolveMiniCartThumbUrl(rawImage: string | null | undefined): string {
  const trimmed = rawImage?.trim() ?? '';
  if (!trimmed || trimmed.startsWith(LEGACY_ILLUSTRATIONS_PREFIX)) return '';
  const normalized = trimmed.startsWith(PRODUCTS_IMG_PREFIX)
    ? trimmed.slice(PRODUCTS_IMG_PREFIX.length)
    : trimmed;
  if (isPlaceholderImage(normalized)) return '';
  return resolveImageUrl(normalized, 'products');
}

function createItemRow(document: Document, item: CartItem): HTMLLIElement {
  const li = document.createElement('li');
  li.className = 'mini-cart__item';

  const resolvedUrl = resolveMiniCartThumbUrl(item.image);

  if (resolvedUrl) {
    const img = document.createElement('img');
    img.className = 'mini-cart__thumb';
    img.width = 48;
    img.height = 48;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = resolvedUrl;
    img.addEventListener('error', () => {
      if (img.parentElement === li) {
        li.replaceChild(createPlaceholderThumb(document), img);
      }
    });
    li.appendChild(img);
  } else {
    li.appendChild(createPlaceholderThumb(document));
  }

  const info = document.createElement('div');
  info.className = 'mini-cart__info';

  const nameLink = document.createElement('a');
  nameLink.className = 'mini-cart__name';
  nameLink.href = `/product?id=${encodeURIComponent(String(item.productId))}`;
  nameLink.textContent = item.name;

  const meta = document.createElement('p');
  meta.className = 'mini-cart__meta';
  const subtotal = item.unitPrice * item.quantity;
  meta.textContent = `${item.quantity} × ${formatPrice(item.unitPrice)} · ${formatPrice(subtotal)}`;

  info.appendChild(nameLink);
  info.appendChild(meta);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'mini-cart__remove';
  removeBtn.setAttribute('aria-label', `Quitar ${item.name} del carrito`);
  removeBtn.setAttribute('title', 'Quitar');
  removeBtn.appendChild(createRemoveIcon(document));
  removeBtn.addEventListener('click', (event: Event) => {
    event.stopPropagation();
    CartService.removeFromCart(item.productId);
  });

  li.appendChild(info);
  li.appendChild(removeBtn);
  return li;
}

export function initializeMiniCart(document: Document): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;

  const trigger = document.getElementById('navbar-cart-trigger') as HTMLButtonElement | null;
  const menu = document.getElementById('navbar-cart-menu');

  if (!trigger || !menu) return () => {};

  const countEl = document.getElementById('mini-cart-count');
  const emptyEl = document.getElementById('mini-cart-empty');
  const contentEl = document.getElementById('mini-cart-content');
  const listEl = document.getElementById('mini-cart-list');
  const totalEl = document.getElementById('mini-cart-total');
  const wrap =
    (typeof trigger.closest === 'function' ? trigger.closest('.home-header__cart-wrap') : null) ??
    menu.parentElement ??
    trigger.parentElement;

  let isOpen = false;

  const setOpen = (open: boolean, restoreFocus = false) => {
    isOpen = open;
    trigger.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
    if (!open && restoreFocus) {
      trigger.focus();
    }
  };

  const render = () => {
    const items = cartItems.get();
    const isEmpty = items.length === 0;
    const focusedInsideList =
      typeof listEl?.contains === 'function' &&
      listEl.contains(document.activeElement ?? null);

    if (countEl) {
      countEl.textContent = isEmpty
        ? ''
        : `${items.length} ${items.length === 1 ? 'pieza' : 'piezas'}`;
    }

    if (emptyEl) emptyEl.hidden = !isEmpty;
    if (contentEl) contentEl.hidden = isEmpty;

    if (listEl) {
      listEl.replaceChildren(...items.map((item) => createItemRow(document, item)));
    }

    if (totalEl) {
      const computedTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      totalEl.textContent = formatPrice(computedTotal);
    }

    if (isOpen && focusedInsideList) {
      const nextRemove = listEl ? listEl.querySelector<HTMLElement>('.mini-cart__remove') : null;
      const fallbackLink = emptyEl ? emptyEl.querySelector('a') : null;
      if (nextRemove && typeof nextRemove.focus === 'function') {
        nextRemove.focus();
      } else if (isEmpty && fallbackLink && typeof fallbackLink.focus === 'function') {
        fallbackLink.focus();
      } else {
        trigger.focus();
      }
    }
  };

  const handleTriggerClick = () => {
    setOpen(!isOpen);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    setOpen(false, true);
  };

  const handleDocumentClick = (event: MouseEvent) => {
    if (!isOpen) return;
    const target = event.target as Node | null;
    if (!target) return;
    const inside = wrap
      ? wrap.contains(target)
      : trigger.contains(target) || menu.contains(target);
    if (!inside) {
      setOpen(false);
    }
  };

  setOpen(false);
  render();

  const unsubscribe = cartItems.subscribe(render);
  trigger.addEventListener('click', handleTriggerClick);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleDocumentClick);

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    unsubscribe();
    trigger.removeEventListener('click', handleTriggerClick);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleDocumentClick);
    cleanups.delete(document);
  };

  cleanups.set(document, cleanup);
  return cleanup;
}
