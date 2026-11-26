import { hydrateDemoSession } from '../config';
import { getSessionUser, isAdminOnly } from '../domains/auth';
import {
  createCategory,
  createFranchise,
  deleteCategory,
  deleteFranchise,
  fetchCategories,
  fetchFranchises,
  updateCategory,
  updateFranchise,
  type CategoryDTO,
  type FranchiseDTO,
} from '../domains/products/services/taxonomy.admin.service';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';

type TaxonomyKind = 'category' | 'franchise';

interface PendingDelete {
  kind: TaxonomyKind;
  id: number;
  name: string;
}

export interface AdminTaxonomyController {
  reload: () => Promise<void>;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.hidden = hidden;
}

export async function initializeAdminTaxonomy(
  document: Document,
): Promise<AdminTaxonomyController> {
  const deniedEl = document.getElementById('admin-gate-denied');
  const contentEl = document.getElementById('admin-taxonomy-content');
  const loadingEl = document.getElementById('admin-taxonomy-loading');
  const errorEl = document.getElementById('admin-taxonomy-error');
  const errorTextEl = document.getElementById('admin-taxonomy-error-text');
  const retryBtn = document.getElementById('admin-taxonomy-retry') as HTMLButtonElement | null;
  const feedbackEl = document.getElementById('admin-taxonomy-feedback');
  const feedbackTextEl = document.getElementById('admin-taxonomy-feedback-text');
  const panelsEl = document.getElementById('admin-taxonomy-panels');

  const categoryForm = document.getElementById('category-create-form') as HTMLFormElement | null;
  const categoryInput = document.getElementById('category-create-input') as HTMLInputElement | null;
  const categoryCreateBtn = document.getElementById(
    'category-create-btn',
  ) as HTMLButtonElement | null;
  const categoriesListEl = document.getElementById('categories-list');
  const categoriesCountEl = document.getElementById('categories-count');

  const franchiseForm = document.getElementById('franchise-create-form') as HTMLFormElement | null;
  const franchiseInput = document.getElementById(
    'franchise-create-input',
  ) as HTMLInputElement | null;
  const franchiseCreateBtn = document.getElementById(
    'franchise-create-btn',
  ) as HTMLButtonElement | null;
  const franchisesListEl = document.getElementById('franchises-list');
  const franchisesCountEl = document.getElementById('franchises-count');

  const deleteDialogEl = document.getElementById(
    'admin-taxonomy-delete-dialog',
  ) as HTMLDialogElement | null;
  const dialogTitleEl = document.getElementById('admin-taxonomy-dialog-title');
  const dialogBodyEl = document.getElementById('admin-taxonomy-dialog-body');

  let categories: CategoryDTO[] = [];
  let franchises: FranchiseDTO[] = [];
  let pendingDelete: PendingDelete | null = null;
  const busyKeys = new Set<string>();

  const showFeedback = (tone: 'success' | 'danger', message: string): void => {
    if (!feedbackEl || !feedbackTextEl) return;
    feedbackEl.className = `ui-callout ui-callout--${tone}`;
    feedbackEl.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    feedbackTextEl.textContent = message;
    setHidden(feedbackEl, false);
  };

  const renderRow = (kind: TaxonomyKind, id: number, name: string): HTMLLIElement => {
    const key = `${kind}:${id}`;
    const busy = busyKeys.has(key);

    const li = document.createElement('li');
    li.className = 'admin-taxonomy__row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ui-input admin-taxonomy__row-input';
    input.value = name;
    input.disabled = busy;
    input.setAttribute(
      'aria-label',
      kind === 'category' ? `Nombre de categoría ${name}` : `Nombre de franquicia ${name}`,
    );

    const actions = document.createElement('div');
    actions.className = 'admin-taxonomy__row-actions';

    const saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'ui-btn ui-btn--secondary ui-btn--sm';
    saveBtn.textContent = 'Guardar';
    saveBtn.disabled = busy;
    saveBtn.addEventListener('click', () => {
      void handleUpdate(kind, id, input.value);
    });

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'ui-btn ui-btn--danger-soft ui-btn--sm';
    delBtn.textContent = 'Eliminar';
    delBtn.disabled = busy;
    delBtn.addEventListener('click', () => {
      openDeleteDialog({ kind, id, name });
    });

    actions.append(saveBtn, delBtn);
    li.append(input, actions);
    return li;
  };

  const renderAll = (): void => {
    if (categoriesCountEl) categoriesCountEl.textContent = String(categories.length);
    if (franchisesCountEl) franchisesCountEl.textContent = String(franchises.length);

    if (categoriesListEl) {
      categoriesListEl.replaceChildren(
        ...categories.map((c) => renderRow('category', c.idCategory, c.nameCategory)),
      );
    }
    if (franchisesListEl) {
      franchisesListEl.replaceChildren(
        ...franchises.map((f) => renderRow('franchise', f.idFranchise, f.nameFranchise)),
      );
    }
  };

  const handleUpdate = async (kind: TaxonomyKind, id: number, rawName: string): Promise<void> => {
    const trimmed = rawName.trim();
    if (!trimmed) {
      showFeedback('danger', 'El nombre no puede quedar vacío.');
      return;
    }
    const key = `${kind}:${id}`;
    if (busyKeys.has(key)) return;
    busyKeys.add(key);
    renderAll();

    try {
      if (kind === 'category') {
        const res = await updateCategory(id, trimmed);
        if (!res.ok) {
          showFeedback('danger', res.message);
          return;
        }
        categories = categories.map((c) => (c.idCategory === id ? res.item : c));
        showFeedback('success', `Categoría actualizada a "${res.item.nameCategory}".`);
      } else {
        const res = await updateFranchise(id, trimmed);
        if (!res.ok) {
          showFeedback('danger', res.message);
          return;
        }
        franchises = franchises.map((f) => (f.idFranchise === id ? res.item : f));
        showFeedback('success', `Franquicia actualizada a "${res.item.nameFranchise}".`);
      }
    } finally {
      busyKeys.delete(key);
      renderAll();
    }
  };

  const executeDelete = async (target: PendingDelete): Promise<void> => {
    const key = `${target.kind}:${target.id}`;
    if (busyKeys.has(key)) return;
    busyKeys.add(key);
    renderAll();

    try {
      const res =
        target.kind === 'category'
          ? await deleteCategory(target.id)
          : await deleteFranchise(target.id);
      if (!res.ok) {
        showFeedback('danger', res.message);
        return;
      }
      if (target.kind === 'category') {
        categories = categories.filter((c) => c.idCategory !== target.id);
        showFeedback('success', `Categoría "${target.name}" eliminada.`);
      } else {
        franchises = franchises.filter((f) => f.idFranchise !== target.id);
        showFeedback('success', `Franquicia "${target.name}" eliminada.`);
      }
    } finally {
      busyKeys.delete(key);
      renderAll();
    }
  };

  const openDeleteDialog = (target: PendingDelete): void => {
    pendingDelete = target;
    if (!deleteDialogEl || typeof deleteDialogEl.showModal !== 'function') {
      const next = pendingDelete;
      pendingDelete = null;
      void executeDelete(next);
      return;
    }

    const noun = target.kind === 'category' ? 'categoría' : 'franquicia';
    if (dialogTitleEl) dialogTitleEl.textContent = `Eliminar ${noun} "${target.name}"`;
    if (dialogBodyEl) {
      dialogBodyEl.textContent = `Esta acción elimina la ${noun} del catálogo. Si todavía tiene piezas asociadas, el servidor la rechazará automáticamente.`;
    }
    deleteDialogEl.returnValue = '';
    deleteDialogEl.showModal();
  };

  deleteDialogEl?.addEventListener('close', () => {
    const choice = deleteDialogEl.returnValue;
    deleteDialogEl.returnValue = '';
    const target = pendingDelete;
    pendingDelete = null;
    if (choice === 'confirm' && target) {
      void executeDelete(target);
    }
  });

  const handleCreate = async (kind: TaxonomyKind): Promise<void> => {
    const input = kind === 'category' ? categoryInput : franchiseInput;
    const button = kind === 'category' ? categoryCreateBtn : franchiseCreateBtn;
    const trimmed = input?.value.trim() ?? '';
    if (!trimmed) {
      showFeedback('danger', 'Ingresá un nombre antes de agregar.');
      return;
    }

    if (button) button.disabled = true;
    try {
      if (kind === 'category') {
        const res = await createCategory(trimmed);
        if (!res.ok) {
          showFeedback('danger', res.message);
          return;
        }
        categories = [...categories, res.item];
        if (input) input.value = '';
        showFeedback('success', `Categoría "${res.item.nameCategory}" agregada.`);
      } else {
        const res = await createFranchise(trimmed);
        if (!res.ok) {
          showFeedback('danger', res.message);
          return;
        }
        franchises = [...franchises, res.item];
        if (input) input.value = '';
        showFeedback('success', `Franquicia "${res.item.nameFranchise}" agregada.`);
      }
      renderAll();
    } finally {
      if (button) button.disabled = false;
    }
  };

  const loadTaxonomy = async (): Promise<void> => {
    setHidden(loadingEl, false);
    setHidden(errorEl, true);
    setHidden(panelsEl, true);
    setHidden(feedbackEl, true);

    const [catRes, franRes] = await Promise.all([fetchCategories(), fetchFranchises()]);
    setHidden(loadingEl, true);

    if (!catRes.ok || !franRes.ok) {
      const message = !catRes.ok ? catRes.message : !franRes.ok ? franRes.message : '';
      if (errorTextEl) errorTextEl.textContent = message;
      setHidden(errorEl, false);
      return;
    }

    categories = catRes.items;
    franchises = franRes.items;
    renderAll();
    setHidden(panelsEl, false);
  };

  let sessionUser = getSessionUser();
  if (!isAdminOnly(sessionUser) && isDemoSessionPendingHydration()) {
    await hydrateDemoSession();
    sessionUser = getSessionUser();
  }
  if (!isAdminOnly(sessionUser)) {
    setHidden(contentEl, true);
    setHidden(deniedEl, false);
    return { reload: loadTaxonomy };
  }

  setHidden(deniedEl, true);
  setHidden(contentEl, false);

  categoryForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleCreate('category');
  });
  franchiseForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    void handleCreate('franchise');
  });
  retryBtn?.addEventListener('click', () => {
    void loadTaxonomy();
  });

  await loadTaxonomy();
  return { reload: loadTaxonomy };
}
