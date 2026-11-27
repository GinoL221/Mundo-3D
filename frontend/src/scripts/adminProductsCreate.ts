import { hydrateDemoSession, isDemoSessionActive } from '../config';
import { getSessionUser, hasAdminAccess } from '../domains/auth';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';
import { ProductAdminApiError, ProductAdminService } from '../domains/products';
import {
  buildProductFormData,
  validateProductForm,
} from '../domains/products/admin/productAdminHelpers';
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
} from './adminProductsForm';

const DEMO_EXPIRED_MESSAGE =
  'Tu sesión demo expiró. Iniciá una nueva demo desde la barra superior para continuar.';

export function initializeAdminProductsCreate(): void {
  const deniedEl = document.getElementById('admin-gate-denied');
  const contentEl = document.getElementById('admin-create-content');
  const roleBadgeEl = document.getElementById('admin-role-badge');
  const scopeEl = document.getElementById('admin-scope-text');

  const sessionUser = getSessionUser();
  if (!hasAdminAccess(sessionUser)) {
    if (isDemoSessionPendingHydration()) {
      void hydrateDemoSession().then(() => {
        if (hasAdminAccess(getSessionUser())) {
          initAdminProductsCreateContent(contentEl, roleBadgeEl, scopeEl);
        } else if (deniedEl) {
          deniedEl.hidden = false;
        }
      });
      return;
    }
    if (deniedEl) deniedEl.hidden = false;
    return;
  }

  initAdminProductsCreateContent(contentEl, roleBadgeEl, scopeEl);
}

function initAdminProductsCreateContent(
  contentEl: HTMLElement | null,
  roleBadgeEl: HTMLElement | null,
  scopeEl: HTMLElement | null,
): void {
  applyAdminRoleHeader(roleBadgeEl, scopeEl, {
    adminScope: 'Cargá una nueva pieza en el Catálogo con clasificación y stock inicial opcional.',
    staffScope:
      'Cargá una nueva pieza en el Catálogo. Como Taller podés crearla y ajustar stock, pero no eliminarla.',
  });

  if (contentEl) contentEl.hidden = false;

  const form = document.getElementById('create-product-form') as HTMLFormElement | null;
  const errorBox = document.getElementById('create-error');
  const createBtn = document.getElementById('create-btn') as HTMLButtonElement | null;
  const categorySelect = document.getElementById('idCategory') as HTMLSelectElement | null;
  const franchiseSelect = document.getElementById('idFranchise') as HTMLSelectElement | null;
  const classificationWarning = document.getElementById('classification-load-warning');
  const classificationRetryBtn = document.getElementById('classification-retry-btn');
  const materialSelect = document.getElementById('material') as HTMLSelectElement | null;
  const materialCustomWrap = document.getElementById('materialCustom-wrap');
  const materialCustomInput = document.getElementById('materialCustom') as HTMLInputElement | null;

  const fileInput = document.getElementById('image') as HTMLInputElement | null;
  if (isDemoSessionActive()) {
    fileInput?.removeAttribute('required');
    const reqMark = document.getElementById('image-required-mark');
    if (reqMark) reqMark.hidden = true;
    const demoNote = document.getElementById('image-demo-note');
    if (demoNote) demoNote.hidden = false;
  }

  wireMaterialToggle(materialSelect, materialCustomWrap, materialCustomInput);
  wireImagePickerPreview(
    {
      fileInput,
      fileNameEl: document.getElementById('image-file-name'),
      previewWrap: document.getElementById('image-preview-wrap'),
      previewImg: document.getElementById('image-preview-img') as HTMLImageElement | null,
      previewTitle: document.getElementById('image-preview-title'),
      previewCaption: document.getElementById('image-preview-caption'),
    },
    () => null,
  );

  const loadSelects = (): Promise<void> =>
    loadClassificationOptions(categorySelect, franchiseSelect, classificationWarning);

  classificationRetryBtn?.addEventListener('click', () => {
    void loadSelects();
  });

  void loadSelects();

  const createBtnLabel = createBtn?.textContent?.trim() || 'Crear pieza';

  async function handleSubmit(): Promise<void> {
    if (!form) return;

    hideFormErrorBanner(errorBox);
    clearFormFieldErrors(form);

    const values = readProductFormValues(form, 'create');
    const clientErrors = validateProductForm(values, 'create', {
      requireImageOnCreate: !isDemoSessionActive(),
    });
    if (Object.keys(clientErrors).length > 0) {
      applyFormFieldErrors(form, clientErrors);
      showFormErrorBanner(errorBox, 'Revisá los campos marcados antes de crear la pieza.');
      return;
    }

    form.setAttribute('aria-busy', 'true');
    if (createBtn) {
      createBtn.disabled = true;
      createBtn.textContent = 'Creando...';
    }

    const wasDemo = isDemoSessionActive();
    let unauthorized = false;
    try {
      const formData = buildProductFormData(values, 'create');
      await ProductAdminService.create(formData);
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
        if (createBtn) {
          createBtn.disabled = false;
          createBtn.textContent = createBtnLabel;
        }
      }
    }
  }

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSubmit();
  });
}
