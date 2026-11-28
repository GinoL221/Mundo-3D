import { hydrateDemoSession, isDemoSessionActive } from '../config';
import { getSessionUser, hasAdminAccess } from '../domains/auth';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';
import { ProductAdminApiError, ProductAdminService } from '../domains/products';
import type { AdminProductDTO } from '../domains/products';
import { getCategoryImg, isPlaceholderImage } from '../domains/products/adapters/product.adapter';
import {
  buildProductFormData,
  parseAdminProductId,
  parseMaterialValue,
  validateProductForm,
} from '../domains/products/admin/productAdminHelpers';
import { resolveImageUrl } from '../lib/imageUrl';
import {
  applyAdminRoleHeader,
  applyFormFieldErrors,
  clearFormFieldErrors,
  hideFormErrorBanner,
  loadClassificationOptions,
  navigateToInternalRoute,
  readProductFormValues,
  showFormErrorBanner,
  wireImagePickerPreview,
  wireMaterialToggle,
  type PreviewFallback,
} from './adminProductsForm';

const DEMO_EXPIRED_MESSAGE =
  'Tu sesión demo expiró. Iniciá una nueva demo desde la barra superior para continuar.';

function getProductId(): number | null {
  const searchParams = new URLSearchParams(window.location.search);
  return parseAdminProductId(searchParams.get('id'));
}

export function initializeAdminProductsEdit(): void {
  const deniedEl = document.getElementById('admin-gate-denied');

  const sessionUser = getSessionUser();
  if (!hasAdminAccess(sessionUser)) {
    if (isDemoSessionPendingHydration()) {
      void hydrateDemoSession().then(() => {
        if (hasAdminAccess(getSessionUser())) {
          initAdminProductsEditContent();
        } else if (deniedEl) {
          deniedEl.hidden = false;
        }
      });
      return;
    }
    if (deniedEl) deniedEl.hidden = false;
    return;
  }

  initAdminProductsEditContent();
}

function initAdminProductsEditContent(): void {
  const editShellEl = document.getElementById('admin-edit-shell');
  const loadingEl = document.getElementById('admin-edit-loading');
  const loadErrorEl = document.getElementById('admin-edit-load-error');
  const loadErrorTextEl = document.getElementById('admin-edit-load-error-text');
  const retryBtn = document.getElementById('admin-edit-retry');
  const contentEl = document.getElementById('admin-edit-content');
  const roleBadgeEl = document.getElementById('admin-role-badge');
  const scopeEl = document.getElementById('admin-scope-text');

  if (editShellEl) editShellEl.hidden = false;

  applyAdminRoleHeader(roleBadgeEl, scopeEl, {
    adminScope:
      'Actualizá los datos de la pieza en el Catálogo. El stock se ajusta desde el listado.',
    staffScope: 'Actualizá los datos de la pieza como Taller. El stock se ajusta desde el listado.',
  });

  const productId = getProductId();
  if (!productId) {
    if (loadErrorTextEl) {
      loadErrorTextEl.textContent = 'No indicaste un identificador válido de pieza para editar.';
    }
    if (retryBtn) retryBtn.hidden = true;
    if (loadErrorEl) loadErrorEl.hidden = false;
    return;
  }

  const form = document.getElementById('edit-product-form') as HTMLFormElement | null;
  const errorBox = document.getElementById('edit-error');
  const editBtn = document.getElementById('edit-btn') as HTMLButtonElement | null;
  const categorySelect = document.getElementById('idCategory') as HTMLSelectElement | null;
  const franchiseSelect = document.getElementById('idFranchise') as HTMLSelectElement | null;
  const classificationWarning = document.getElementById('classification-load-warning');
  const classificationRetryBtn = document.getElementById('classification-retry-btn');
  const materialSelect = document.getElementById('material') as HTMLSelectElement | null;
  const materialCustomWrap = document.getElementById('materialCustom-wrap');
  const materialCustomInput = document.getElementById('materialCustom') as HTMLInputElement | null;

  const syncMaterial = wireMaterialToggle(materialSelect, materialCustomWrap, materialCustomInput);
  if (isDemoSessionActive()) {
    const demoNote = document.getElementById('image-demo-note');
    if (demoNote) {
      demoNote.textContent =
        'En modo demo no se suben archivos externos: se conserva la imagen actual de la pieza.';
      demoNote.hidden = false;
    }
  }

  let currentFallbackPreview: PreviewFallback | null = null;
  let loadedCategoryId = '';
  let loadedFranchiseId = '';
  const refreshImagePreview = wireImagePickerPreview(
    {
      fileInput: document.getElementById('image') as HTMLInputElement | null,
      fileNameEl: document.getElementById('image-file-name'),
      previewWrap: document.getElementById('image-preview-wrap'),
      previewImg: document.getElementById('image-preview-img') as HTMLImageElement | null,
      previewTitle: document.getElementById('image-preview-title'),
      previewCaption: document.getElementById('image-preview-caption'),
    },
    () => currentFallbackPreview,
  );

  classificationRetryBtn?.addEventListener('click', () => {
    void loadClassificationOptions(categorySelect, franchiseSelect, classificationWarning, {
      idCategory: categorySelect?.value || loadedCategoryId,
      idFranchise: franchiseSelect?.value || loadedFranchiseId,
    });
  });

  function fillForm(product: AdminProductDTO): void {
    loadedCategoryId = String(product.idCategory);
    loadedFranchiseId = String(product.idFranchise);
    const set = (id: string, value: string | number | null | undefined) => {
      const el = document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | HTMLSelectElement
        | null;
      if (el) {
        el.value = value !== null && value !== undefined ? String(value) : '';
      }
    };

    set('nameProduct', product.nameProduct);
    set('price', product.price);
    set('descriptionProduct', product.descriptionProduct);
    set('idCategory', product.idCategory);
    set('idFranchise', product.idFranchise);

    const parsedMaterial = parseMaterialValue(product.material);
    set('material', parsedMaterial.selectValue);
    set('materialCustom', parsedMaterial.customDetail);
    syncMaterial();

    set('height', product.height);
    set('width', product.width);
    set('depth', product.depth);
    set('finish', product.finish);
    set('productionTime', product.productionTime);

    const catImg = getCategoryImg(product.category || 'Otras');
    const fallbackSrc = `/images/illustrations/${catImg}.svg`;
    const isPlaceholder = isPlaceholderImage(product.image);
    const resolvedSrc = isPlaceholder
      ? fallbackSrc
      : resolveImageUrl(product.image, 'products') || fallbackSrc;

    currentFallbackPreview = {
      src: resolvedSrc,
      alt: `Vista previa actual de ${product.nameProduct}`,
      title: 'Imagen actual en el Catálogo',
      caption: product.image
        ? `${product.image} (se conserva si no subís un archivo nuevo)`
        : 'Sin fotografía cargada (se muestra ilustración de categoría)',
      isPlaceholder,
    };

    const previewImg = document.getElementById('image-preview-img') as HTMLImageElement | null;
    previewImg?.addEventListener(
      'error',
      () => {
        if (!previewImg || previewImg.dataset.fallback) return;
        previewImg.dataset.fallback = 'true';
        previewImg.src = fallbackSrc;
        previewImg.classList.add('admin-products__thumb--placeholder');
      },
      { once: true },
    );

    refreshImagePreview();
  }

  async function loadProduct(id: number): Promise<void> {
    if (loadingEl) loadingEl.hidden = false;
    if (loadErrorEl) loadErrorEl.hidden = true;
    if (contentEl) contentEl.hidden = true;

    const wasDemo = isDemoSessionActive();
    try {
      const product = await ProductAdminService.getById(id);
      await loadClassificationOptions(categorySelect, franchiseSelect, classificationWarning, {
        idCategory: String(product.idCategory),
        idFranchise: String(product.idFranchise),
      });
      fillForm(product);

      if (loadingEl) loadingEl.hidden = true;
      if (contentEl) contentEl.hidden = false;
    } catch (err) {
      if (err instanceof ProductAdminApiError && err.status === 401) {
        if (!wasDemo) {
          // authFetch already handles 401 teardown and /login redirect.
          return;
        }
        if (loadingEl) loadingEl.hidden = true;
        if (loadErrorTextEl) loadErrorTextEl.textContent = DEMO_EXPIRED_MESSAGE;
        if (loadErrorEl) loadErrorEl.hidden = false;
        return;
      }
      if (loadingEl) loadingEl.hidden = true;
      if (loadErrorTextEl) {
        loadErrorTextEl.textContent =
          err instanceof ProductAdminApiError && err.status === 404
            ? 'No encontramos la pieza solicitada en el Catálogo.'
            : 'No se pudo cargar la pieza para editar. Intentá nuevamente en unos segundos.';
      }
      if (loadErrorEl) loadErrorEl.hidden = false;
    }
  }

  retryBtn?.addEventListener('click', () => {
    void loadProduct(productId);
  });

  void loadProduct(productId);

  const editBtnLabel = editBtn?.textContent?.trim() || 'Guardar cambios';

  async function handleSubmit(id: number): Promise<void> {
    if (!form) return;

    hideFormErrorBanner(errorBox);
    clearFormFieldErrors(form);

    const values = readProductFormValues(form, 'edit');
    const clientErrors = validateProductForm(values, 'edit');
    if (Object.keys(clientErrors).length > 0) {
      applyFormFieldErrors(form, clientErrors);
      showFormErrorBanner(errorBox, 'Revisá los campos marcados antes de guardar los cambios.');
      return;
    }

    form.setAttribute('aria-busy', 'true');
    if (editBtn) {
      editBtn.disabled = true;
      editBtn.textContent = 'Guardando...';
    }

    const wasDemo = isDemoSessionActive();
    let unauthorized = false;
    try {
      const formData = buildProductFormData(values, 'edit');
      await ProductAdminService.update(id, formData);
      navigateToInternalRoute('/admin/products');
    } catch (err) {
      if (err instanceof ProductAdminApiError && err.status === 401) {
        if (!wasDemo) {
          // authFetch already handles 401 teardown and /login redirect.
          unauthorized = true;
          return;
        }
        showFormErrorBanner(errorBox, DEMO_EXPIRED_MESSAGE);
        return;
      }
      if (err instanceof ProductAdminApiError) {
        if (Object.keys(err.fieldErrors).length > 0) {
          applyFormFieldErrors(form, err.fieldErrors);
        }
        showFormErrorBanner(errorBox, err.message);
      } else if (err instanceof Error) {
        showFormErrorBanner(errorBox, err.message);
      } else {
        showFormErrorBanner(errorBox, 'No se pudo conectar con el servidor. Intentá de nuevo.');
      }
    } finally {
      if (!unauthorized) {
        form.removeAttribute('aria-busy');
        if (editBtn) {
          editBtn.disabled = false;
          editBtn.textContent = editBtnLabel;
        }
      }
    }
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSubmit(productId);
  });
}
