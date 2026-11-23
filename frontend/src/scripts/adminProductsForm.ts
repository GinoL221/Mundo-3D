import { clearSession, getSessionUser } from '../domains/auth';
import { fetchFilterOptions } from '../domains/products';
import type { FilterOption } from '../domains/products';
import {
  CUSTOM_MATERIAL_OPTION,
  resolveFieldIdForApiKey,
  type ProductFormValues,
} from '../domains/products/admin/productAdminHelpers';
import { Role } from '../domains/auth/adapters/auth.adapter';

export interface PreviewFallback {
  src: string;
  alt: string;
  title: string;
  caption: string;
  isPlaceholder?: boolean;
}

export function applyAdminRoleHeader(
  badgeEl: HTMLElement | null,
  scopeEl: HTMLElement | null,
  copy: { adminScope: string; staffScope: string },
): void {
  const sessionUser = getSessionUser();
  const isAdmin = sessionUser?.idRole === Role.ADMIN;

  if (badgeEl) {
    badgeEl.textContent = isAdmin ? 'ADMIN' : 'STAFF';
    badgeEl.className = `ui-badge ${isAdmin ? 'ui-badge--admin' : 'ui-badge--staff'}`;
  }

  if (scopeEl) {
    scopeEl.textContent = isAdmin ? copy.adminScope : copy.staffScope;
  }
}

export function navigateToInternalRoute(path: '/login' | '/admin/products'): void {
  if (path.startsWith('/') && !path.startsWith('//')) {
    window.location.assign(path);
  }
}

export function handleAdminUnauthorized(): void {
  void clearSession();
  navigateToInternalRoute('/login');
}

function populateSelectOptions(
  selectEl: HTMLSelectElement | null,
  options: FilterOption[],
  placeholderLabel: string,
  selectedValue: string,
): void {
  if (!selectEl) return;
  const previous = selectedValue || selectEl.value;
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = placeholderLabel;

  const optionNodes = options.map((opt) => {
    const option = document.createElement('option');
    option.value = String(opt.id);
    option.textContent = opt.name;
    return option;
  });

  selectEl.replaceChildren(placeholder, ...optionNodes);

  if (previous && options.some((opt) => String(opt.id) === previous)) {
    selectEl.value = previous;
  }
}

export async function loadClassificationOptions(
  categorySelect: HTMLSelectElement | null,
  franchiseSelect: HTMLSelectElement | null,
  warningEl: HTMLElement | null,
  selected: { idCategory?: string; idFranchise?: string } = {},
): Promise<void> {
  const { categories, franchises } = await fetchFilterOptions();

  populateSelectOptions(
    categorySelect,
    categories,
    'Elegí una categoría',
    selected.idCategory ?? '',
  );
  populateSelectOptions(
    franchiseSelect,
    franchises,
    'Elegí una franquicia',
    selected.idFranchise ?? '',
  );

  if (warningEl) {
    warningEl.hidden = categories.length > 0 && franchises.length > 0;
  }
}

export function wireMaterialToggle(
  materialSelect: HTMLSelectElement | null,
  customWrap: HTMLElement | null,
  customInput: HTMLInputElement | null,
): () => void {
  const sync = (): void => {
    const isCustom = materialSelect?.value === CUSTOM_MATERIAL_OPTION;
    if (customWrap) customWrap.hidden = !isCustom;
    if (!isCustom && customInput) {
      customInput.removeAttribute('aria-invalid');
      const errorEl = document.getElementById('materialCustom-error');
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
    }
  };

  materialSelect?.addEventListener('change', sync);
  sync();
  return sync;
}

export function wireImagePickerPreview(
  elements: {
    fileInput: HTMLInputElement | null;
    fileNameEl: HTMLElement | null;
    previewWrap: HTMLElement | null;
    previewImg: HTMLImageElement | null;
    previewTitle: HTMLElement | null;
    previewCaption: HTMLElement | null;
  },
  getFallbackPreview: () => PreviewFallback | null,
): () => void {
  let activeObjectUrl: string | null = null;

  const revokeActiveUrl = (): void => {
    if (activeObjectUrl) {
      URL.revokeObjectURL(activeObjectUrl);
      activeObjectUrl = null;
    }
  };

  const renderPreview = (): void => {
    const file = elements.fileInput?.files?.[0] ?? null;

    if (file) {
      revokeActiveUrl();
      activeObjectUrl = URL.createObjectURL(file);
      if (elements.fileNameEl) elements.fileNameEl.textContent = file.name;
      if (elements.previewImg) {
        delete elements.previewImg.dataset.fallback;
        elements.previewImg.src = activeObjectUrl;
        elements.previewImg.alt = `Vista previa de ${file.name}`;
        elements.previewImg.classList.remove('admin-products__thumb--placeholder');
      }
      if (elements.previewTitle) elements.previewTitle.textContent = 'Nueva imagen seleccionada';
      if (elements.previewCaption) elements.previewCaption.textContent = file.name;
      if (elements.previewWrap) elements.previewWrap.hidden = false;
      return;
    }

    if (elements.fileNameEl) elements.fileNameEl.textContent = 'Ningún archivo seleccionado';
    const fallback = getFallbackPreview();
    if (fallback && elements.previewWrap && elements.previewImg) {
      delete elements.previewImg.dataset.fallback;
      elements.previewImg.src = fallback.src;
      elements.previewImg.alt = fallback.alt;
      elements.previewImg.classList.toggle(
        'admin-products__thumb--placeholder',
        Boolean(fallback.isPlaceholder),
      );
      if (elements.previewTitle) elements.previewTitle.textContent = fallback.title;
      if (elements.previewCaption) elements.previewCaption.textContent = fallback.caption;
      elements.previewWrap.hidden = false;
    } else if (elements.previewWrap) {
      elements.previewWrap.hidden = true;
    }
  };

  elements.fileInput?.addEventListener('change', renderPreview);
  window.addEventListener('pagehide', revokeActiveUrl, { once: true });
  return renderPreview;
}

export function readProductFormValues(
  form: HTMLFormElement,
  mode: 'create' | 'edit',
): ProductFormValues {
  const valueOf = (id: string): string => {
    const el = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`#${id}`);
    return el?.value ?? '';
  };

  const fileInput = form.querySelector<HTMLInputElement>('#image');
  const imageFile = fileInput?.files?.[0] ?? null;

  return {
    nameProduct: valueOf('nameProduct'),
    price: valueOf('price'),
    descriptionProduct: valueOf('descriptionProduct'),
    idCategory: valueOf('idCategory'),
    idFranchise: valueOf('idFranchise'),
    materialSelect: valueOf('material'),
    materialCustom: valueOf('materialCustom'),
    height: valueOf('height'),
    width: valueOf('width'),
    depth: valueOf('depth'),
    finish: valueOf('finish'),
    productionTime: valueOf('productionTime'),
    ...(mode === 'create' ? { stock: valueOf('stock') } : {}),
    imageFile,
  };
}

export function clearFormFieldErrors(form: HTMLFormElement): void {
  const invalidControls = form.querySelectorAll<HTMLElement>('[aria-invalid="true"]');
  for (const control of invalidControls) {
    control.removeAttribute('aria-invalid');
    const errorId = `${control.id}-error`;
    const describedBy = control.getAttribute('aria-describedby');
    if (describedBy) {
      const next = describedBy
        .split(/\s+/)
        .filter((token) => token && token !== errorId)
        .join(' ');
      if (next) {
        control.setAttribute('aria-describedby', next);
      } else {
        control.removeAttribute('aria-describedby');
      }
    }
  }

  const errorEls = form.querySelectorAll<HTMLElement>('.ui-error');
  for (const el of errorEls) {
    el.hidden = true;
    el.textContent = '';
  }
}

export function applyFormFieldErrors(
  form: HTMLFormElement,
  fieldErrors: Record<string, string>,
): void {
  let firstInvalidControl: HTMLElement | null = null;

  for (const [rawKey, message] of Object.entries(fieldErrors)) {
    let fieldId = resolveFieldIdForApiKey(rawKey);
    if (!fieldId) continue;

    if (fieldId === 'material') {
      const materialSelect = form.querySelector<HTMLSelectElement>('#material');
      if (materialSelect?.value === CUSTOM_MATERIAL_OPTION) {
        fieldId = 'materialCustom';
      }
    }

    const control = form.querySelector<HTMLElement>(`#${fieldId}`);
    const errorEl = form.querySelector<HTMLElement>(`#${fieldId}-error`);
    if (!control || !errorEl) continue;

    control.setAttribute('aria-invalid', 'true');
    const errorId = `${fieldId}-error`;
    const currentDescribedBy = control.getAttribute('aria-describedby') ?? '';
    const tokens = currentDescribedBy.split(/\s+/).filter(Boolean);
    if (!tokens.includes(errorId)) {
      tokens.push(errorId);
      control.setAttribute('aria-describedby', tokens.join(' '));
    }

    errorEl.textContent = message;
    errorEl.hidden = false;

    if (!firstInvalidControl) {
      firstInvalidControl = control;
    }
  }

  firstInvalidControl?.focus();
}

export function showFormErrorBanner(errorBox: HTMLElement | null, msg: string): void {
  if (!errorBox) return;
  const textEl = errorBox.querySelector<HTMLElement>('.ui-callout__text');
  if (textEl) {
    textEl.textContent = msg;
  } else {
    errorBox.textContent = msg;
  }
  errorBox.hidden = false;
}

export function hideFormErrorBanner(errorBox: HTMLElement | null): void {
  if (errorBox) errorBox.hidden = true;
}
