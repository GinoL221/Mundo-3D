import { clearSession, getSessionUser, hasAdminAccess } from '../domains/auth';
import {
  CustomCommissionRequestAdminApiError,
  listCustomCommissionRequests,
} from '../domains/commissions/services/customCommissionRequest.admin.service';
import { fetchProducts } from '../domains/products/services/product.service';
import {
  buildCommissionPieceReference,
  buildCommissionRequestItemViewModel,
  resolveAdminRoleBadge,
} from './adminCommissionRequestsModel';

export interface AdminCommissionRequestsController {
  reload: () => Promise<void>;
}

interface PendingPieceLink {
  idProduct: number;
  linkEl: HTMLAnchorElement;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.hidden = hidden;
}

function renderInboxItem(
  document: Document,
  viewModel: ReturnType<typeof buildCommissionRequestItemViewModel>,
): { element: HTMLLIElement; pendingPiece: PendingPieceLink | null } {
  const item = document.createElement('li');
  item.className = 'ui-inbox__item';

  const head = document.createElement('div');
  head.className = 'ui-inbox__head';

  const requester = document.createElement('h2');
  requester.className = 'ui-inbox__requester';
  requester.textContent = viewModel.requesterName;

  const dates = document.createElement('p');
  dates.className = 'ui-inbox__dates';
  dates.textContent = viewModel.datesLabel;

  head.append(requester, dates);

  const meta = document.createElement('div');
  meta.className = 'ui-inbox__meta';

  if (viewModel.mailtoHref) {
    const emailLink = document.createElement('a');
    emailLink.className = 'ui-inbox__link';
    emailLink.href = viewModel.mailtoHref;
    emailLink.textContent = viewModel.emailLabel;
    meta.append(emailLink);
  } else {
    const emailText = document.createElement('span');
    emailText.className = 'ui-inbox__muted';
    emailText.textContent = viewModel.emailLabel;
    meta.append(emailText);
  }

  let pendingPiece: PendingPieceLink | null = null;
  if (viewModel.piece.kind === 'link') {
    const pieceLink = document.createElement('a');
    pieceLink.className = 'ui-inbox__link';
    pieceLink.href = viewModel.piece.href;
    pieceLink.textContent = viewModel.piece.label;
    meta.append(pieceLink);
    pendingPiece = { idProduct: viewModel.piece.idProduct, linkEl: pieceLink };
  } else {
    const noPiece = document.createElement('span');
    noPiece.className = 'ui-inbox__muted';
    noPiece.textContent = viewModel.piece.label;
    meta.append(noPiece);
  }

  const idea = document.createElement('p');
  idea.className = 'ui-inbox__idea';
  idea.textContent = viewModel.idea;

  item.append(head, meta, idea);
  return { element: item, pendingPiece };
}

export async function initializeAdminCommissionRequests(
  document: Document,
  window: Pick<Window, 'location'>,
): Promise<AdminCommissionRequestsController> {
  const roleBadge = document.getElementById('admin-role-badge');
  const scopeNote = document.getElementById('admin-requests-scope');
  const deniedEl = document.getElementById('admin-gate-denied');
  const contentEl = document.getElementById('admin-requests-content');
  const loadingEl = document.getElementById('admin-requests-loading');
  const errorEl = document.getElementById('admin-requests-error');
  const errorTextEl = document.getElementById('admin-requests-error-text');
  const retryBtn = document.getElementById('admin-requests-retry') as HTMLButtonElement | null;
  const emptyEl = document.getElementById('admin-requests-empty');
  const listEl = document.getElementById('admin-requests-list');

  let activeAttempt = 0;

  const loadRequests = async (): Promise<void> => {
    if (!loadingEl || !errorEl || !emptyEl || !listEl) return;

    activeAttempt += 1;
    const attempt = activeAttempt;

    if (retryBtn) retryBtn.disabled = true;
    loadingEl.setAttribute('aria-busy', 'true');
    setHidden(loadingEl, false);
    setHidden(errorEl, true);
    setHidden(emptyEl, true);
    setHidden(listEl, true);
    listEl.replaceChildren();

    try {
      const requests = await listCustomCommissionRequests();
      if (attempt !== activeAttempt) return;

      loadingEl.removeAttribute('aria-busy');
      setHidden(loadingEl, true);

      if (requests.length === 0) {
        setHidden(emptyEl, false);
        return;
      }

      const pendingPieces: PendingPieceLink[] = [];
      const renderedItems: HTMLLIElement[] = [];

      for (const request of requests) {
        const viewModel = buildCommissionRequestItemViewModel(request);
        const { element, pendingPiece } = renderInboxItem(document, viewModel);
        renderedItems.push(element);
        if (pendingPiece) pendingPieces.push(pendingPiece);
      }

      // Catalog lookup is deliberately best-effort and non-blocking: its
      // latency or failure must never delay or hide the protected inbox, and
      // we skip it entirely when no request references a catalog piece.
      const catalogPromise =
        pendingPieces.length > 0
          ? fetchProducts().catch(() => ({
              ok: false as const,
              reason: 'network' as const,
            }))
          : null;

      listEl.replaceChildren(...renderedItems);
      setHidden(listEl, false);

      if (catalogPromise) {
        void catalogPromise.then((catalog) => {
          if (attempt !== activeAttempt || !catalog.ok) return;
          const byId = new Map<number, string>();
          for (const product of catalog.products) {
            byId.set(product.id, product.name);
          }
          for (const entry of pendingPieces) {
            const productName = byId.get(entry.idProduct);
            if (!productName) continue;
            const resolved = buildCommissionPieceReference(entry.idProduct, productName);
            entry.linkEl.textContent = resolved.label;
          }
        });
      }
    } catch (cause) {
      if (attempt !== activeAttempt) return;

      loadingEl.removeAttribute('aria-busy');
      setHidden(loadingEl, true);

      if (cause instanceof CustomCommissionRequestAdminApiError && cause.status === 401) {
        void clearSession();
        window.location.assign('/login');
        return;
      }

      if (errorTextEl) {
        errorTextEl.textContent =
          cause instanceof CustomCommissionRequestAdminApiError && cause.status === 403
            ? 'No tenés permisos suficientes para consultar estas solicitudes.'
            : 'El servicio no respondió a tiempo. Volvé a intentar en unos segundos.';
      }
      setHidden(errorEl, false);
    } finally {
      if (retryBtn && attempt === activeAttempt) {
        retryBtn.disabled = false;
      }
    }
  };

  const sessionUser = getSessionUser();
  if (!hasAdminAccess(sessionUser)) {
    setHidden(roleBadge, true);
    setHidden(scopeNote, true);
    setHidden(contentEl, true);
    setHidden(deniedEl, false);
    return { reload: loadRequests };
  }

  const badge = resolveAdminRoleBadge(sessionUser);
  if (roleBadge && badge) {
    roleBadge.textContent = badge.label;
    roleBadge.className = `ui-badge ${badge.modifierClass}`;
    setHidden(roleBadge, false);
  }
  setHidden(scopeNote, false);
  setHidden(deniedEl, true);
  setHidden(contentEl, false);

  retryBtn?.addEventListener('click', () => {
    void loadRequests();
  });

  await loadRequests();

  return { reload: loadRequests };
}
