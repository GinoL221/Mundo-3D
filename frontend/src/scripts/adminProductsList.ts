import { getSessionUser, hasAdminAccess, isAdminOnly } from '../domains/auth';
import { ProductAdminApiError, ProductAdminService } from '../domains/products';
import type { AdminProductDTO } from '../domains/products';
import { getCategoryImg, isPlaceholderImage } from '../domains/products/adapters/product.adapter';
import {
  formatAdminPrice,
  formatProductMeta,
  getStockStatus,
} from '../domains/products/admin/productAdminHelpers';
import { resolveImageUrl } from '../lib/imageUrl';
import { applyAdminRoleHeader, handleAdminUnauthorized } from './adminProductsForm';

export function initializeAdminProductsList(): void {
  const deniedEl = document.getElementById('admin-gate-denied');
  const contentEl = document.getElementById('admin-products-content');
  const roleBadgeEl = document.getElementById('admin-role-badge');
  const scopeEl = document.getElementById('admin-scope-text');

  const sessionUser = getSessionUser();
  const isAdmin = isAdminOnly(sessionUser);
  const isAdminOrStaff = hasAdminAccess(sessionUser);

  if (!isAdminOrStaff) {
    if (deniedEl) deniedEl.hidden = false;
    return;
  }

  applyAdminRoleHeader(roleBadgeEl, scopeEl, {
    adminScope: 'Podés crear, editar, ajustar stock y eliminar piezas del Catálogo.',
    staffScope:
      'Podés crear y editar piezas y ajustar su stock en el Catálogo. El rol STAFF nunca puede eliminar piezas.',
  });

  if (contentEl) contentEl.hidden = false;

  const retryBtn = document.getElementById('admin-products-retry');
  retryBtn?.addEventListener('click', () => {
    void loadProducts();
  });

  function showInlineError(msg: string): void {
    const errorEl = document.getElementById('admin-error');
    const errorTextEl = document.getElementById('admin-error-text');
    const statusEl = document.getElementById('admin-status');
    if (statusEl) statusEl.hidden = true;
    if (errorEl) errorEl.hidden = false;
    if (errorTextEl) errorTextEl.textContent = msg;
  }

  function hideInlineError(): void {
    const errorEl = document.getElementById('admin-error');
    if (errorEl) errorEl.hidden = true;
  }

  function showInlineStatus(msg: string): void {
    const statusEl = document.getElementById('admin-status');
    const statusTextEl = document.getElementById('admin-status-text');
    hideInlineError();
    if (statusEl) statusEl.hidden = false;
    if (statusTextEl) statusTextEl.textContent = msg;
  }

  function handleUnauthorized(): void {
    handleAdminUnauthorized();
  }

  async function loadProducts(): Promise<void> {
    const listEl = document.getElementById('admin-products-list');
    const loadingEl = document.getElementById('admin-loading-state');
    const loadErrorEl = document.getElementById('admin-load-error');
    const emptyEl = document.getElementById('admin-empty-state');
    const tableWrapEl = document.getElementById('admin-table-wrap');
    if (!listEl) return;

    hideInlineError();
    if (loadingEl) loadingEl.hidden = false;
    if (loadErrorEl) loadErrorEl.hidden = true;
    if (emptyEl) emptyEl.hidden = true;
    if (tableWrapEl) tableWrapEl.hidden = true;
    listEl.replaceChildren();

    try {
      const products = await ProductAdminService.list();
      if (loadingEl) loadingEl.hidden = true;

      if (products.length === 0) {
        if (emptyEl) emptyEl.hidden = false;
        return;
      }

      const rowTemp = document.getElementById(
        'admin-product-row-template',
      ) as HTMLTemplateElement | null;
      if (!rowTemp) return;

      const fragment = document.createDocumentFragment();
      for (const product of products) {
        const clone = rowTemp.content.cloneNode(true) as DocumentFragment;
        renderRow(clone, product);
        fragment.appendChild(clone);
      }
      listEl.appendChild(fragment);
      if (tableWrapEl) tableWrapEl.hidden = false;
    } catch (err) {
      if (err instanceof ProductAdminApiError && err.status === 401) {
        handleUnauthorized();
        return;
      }
      if (loadingEl) loadingEl.hidden = true;
      if (loadErrorEl) loadErrorEl.hidden = false;
    }
  }

  function renderRow(clone: DocumentFragment, product: AdminProductDTO): void {
    const thumbEl = clone.querySelector<HTMLImageElement>('.admin-products__thumb');
    const nameEl = clone.querySelector<HTMLElement>('.admin-product-name');
    const metaEl = clone.querySelector<HTMLElement>('.admin-product-meta');
    const statusBadgeEl = clone.querySelector<HTMLElement>('.admin-product-status');
    const priceEl = clone.querySelector<HTMLElement>('.admin-product-price');
    const stepperGroup = clone.querySelector<HTMLElement>('.ui-stepper');
    const stockEl = clone.querySelector<HTMLElement>('.admin-product-stock');
    const plusBtn = clone.querySelector<HTMLButtonElement>('.admin-product-stock-plus');
    const minusBtn = clone.querySelector<HTMLButtonElement>('.admin-product-stock-minus');
    const editLink = clone.querySelector<HTMLAnchorElement>('.admin-product-edit');
    const deleteBtn = clone.querySelector<HTMLButtonElement>('.admin-product-delete');

    let currentStock = Number.isFinite(product.stock) ? product.stock : 0;

    if (thumbEl) {
      const catImg = getCategoryImg(product.category || 'Otras');
      const fallbackSrc = `/images/illustrations/${catImg}.svg`;
      if (isPlaceholderImage(product.image)) {
        thumbEl.src = fallbackSrc;
        thumbEl.classList.add('admin-products__thumb--placeholder');
      } else {
        thumbEl.src = resolveImageUrl(product.image, 'products') || fallbackSrc;
        thumbEl.addEventListener('error', () => {
          if (thumbEl.dataset.fallback) return;
          thumbEl.dataset.fallback = 'true';
          thumbEl.src = fallbackSrc;
          thumbEl.classList.add('admin-products__thumb--placeholder');
        });
      }
    }

    if (nameEl) nameEl.textContent = product.nameProduct;
    if (metaEl) metaEl.textContent = formatProductMeta(product);
    if (priceEl) priceEl.textContent = formatAdminPrice(product.price);
    if (stepperGroup) {
      stepperGroup.setAttribute('aria-label', `Ajustar stock de ${product.nameProduct}`);
    }

    const syncStockUI = (): void => {
      if (stockEl) stockEl.textContent = String(currentStock);
      if (minusBtn) minusBtn.disabled = currentStock <= 0;
      if (statusBadgeEl) {
        const status = getStockStatus(currentStock);
        statusBadgeEl.textContent = status.label;
        statusBadgeEl.className = `ui-badge admin-product-status ${status.badgeClass}`;
      }
    };

    syncStockUI();

    if (editLink) {
      editLink.href = `/admin/products/edit?id=${product.idProduct}`;
      editLink.setAttribute('aria-label', `Editar ${product.nameProduct}`);
    }
    if (plusBtn) plusBtn.setAttribute('aria-label', `Sumar 1 unidad a ${product.nameProduct}`);
    if (minusBtn) minusBtn.setAttribute('aria-label', `Restar 1 unidad a ${product.nameProduct}`);

    async function applyDelta(delta: 1 | -1): Promise<void> {
      hideInlineError();

      // In-flight guard: the stock-adjust endpoint is not idempotent, so a
      // rapid double-click must not fire two overlapping requests.
      if (plusBtn) plusBtn.disabled = true;
      if (minusBtn) minusBtn.disabled = true;

      try {
        const updated = await ProductAdminService.adjustStock(product.idProduct, delta);
        currentStock = updated.stock;
        syncStockUI();
        showInlineStatus(`Stock de «${product.nameProduct}» actualizado a ${currentStock}.`);
      } catch (err) {
        if (err instanceof ProductAdminApiError && err.status === 401) {
          handleUnauthorized();
          return;
        }
        showInlineError(
          err instanceof Error
            ? err.message
            : `No se pudo ajustar el stock de «${product.nameProduct}».`,
        );
      } finally {
        if (plusBtn) plusBtn.disabled = false;
        if (minusBtn) minusBtn.disabled = currentStock <= 0;
      }
    }

    plusBtn?.addEventListener('click', () => void applyDelta(1));
    minusBtn?.addEventListener('click', () => void applyDelta(-1));

    // Delete Control Visibility (visual-admin-hiding spec): visible/enabled
    // for ADMIN only. STAFF must not see it in the DOM at all — mirrors the
    // backend's ADMIN-only DELETE guard, which stays authoritative regardless.
    if (deleteBtn) {
      if (isAdmin) {
        deleteBtn.setAttribute('aria-label', `Eliminar ${product.nameProduct}`);
        const originalLabel = deleteBtn.textContent ?? 'Eliminar';
        deleteBtn.addEventListener('click', () => {
          if (!window.confirm(`¿Eliminar "${product.nameProduct}"? Esta acción no se puede deshacer.`)) {
            return;
          }
          hideInlineError();
          deleteBtn.disabled = true;
          deleteBtn.textContent = 'Eliminando...';

          ProductAdminService.remove(product.idProduct)
            .then(() => {
              const tr = deleteBtn.closest('tr');
              tr?.remove();
              const listEl = document.getElementById('admin-products-list');
              if (listEl && listEl.children.length === 0) {
                const tableWrapEl = document.getElementById('admin-table-wrap');
                const emptyEl = document.getElementById('admin-empty-state');
                if (tableWrapEl) tableWrapEl.hidden = true;
                if (emptyEl) emptyEl.hidden = false;
              }
              showInlineStatus(`Pieza «${product.nameProduct}» eliminada del Catálogo.`);
            })
            .catch((err) => {
              if (err instanceof ProductAdminApiError && err.status === 401) {
                handleUnauthorized();
                return;
              }
              showInlineError(
                err instanceof Error
                  ? err.message
                  : `No se pudo eliminar «${product.nameProduct}».`,
              );
              deleteBtn.disabled = false;
              deleteBtn.textContent = originalLabel;
            });
        });
      } else {
        deleteBtn.remove();
      }
    }
  }

  void loadProducts();
}
