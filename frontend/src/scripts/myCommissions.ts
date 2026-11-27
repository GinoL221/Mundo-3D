import {
  DEMO_SESSION_EVENT,
  getSessionUser,
  hydrateDemoSession,
  isDemoSessionActive,
  isOperationalRole,
} from '../config';
import {
  listMyCustomCommissionRequests,
  type MyCommissionRequestDTO,
} from '../domains/commissions/services/customCommissionRequest.service';
import { fetchProducts } from '../domains/products/services/product.service';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';
import {
  buildCommissionPieceReference,
  formatCommissionDate,
  type CommissionPieceReference,
  type DateFormatOptions,
} from './adminCommissionRequestsModel';

const DEMO_EXPIRED_MESSAGE =
  'Tu sesión demo expiró. Iniciá una nueva demo desde la barra superior para consultar tus encargos.';

export interface MyCommissionsController {
  reload: () => Promise<void>;
}

export interface MyCommissionItemViewModel {
  id: number;
  requesterName: string;
  emailLabel: string;
  phoneLabel: string | null;
  datesLabel: string;
  idea: string;
  piece: CommissionPieceReference;
}

interface PendingPieceLink {
  idProduct: number;
  linkEl: HTMLAnchorElement;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.hidden = hidden;
}

export function formatMyCommissionDatesLabel(
  createdAt: string,
  expiresAt: string,
  options?: DateFormatOptions,
): string {
  const sent = formatCommissionDate(createdAt, options);
  const expires = formatCommissionDate(expiresAt, options);

  if (sent && expires) {
    return `Enviada el ${sent} · Vence el ${expires}`;
  }
  if (sent) {
    return `Enviada el ${sent}`;
  }
  if (expires) {
    return `Vence el ${expires}`;
  }
  return 'Fecha no disponible';
}

export function buildMyCommissionItemViewModel(
  request: MyCommissionRequestDTO,
  catalogById?: ReadonlyMap<number, string>,
  dateOptions?: DateFormatOptions,
): MyCommissionItemViewModel {
  const rawPhone = typeof request.phone === 'string' ? request.phone.trim() : '';
  const productName =
    request.idProduct !== null ? (catalogById?.get(request.idProduct) ?? null) : null;

  return {
    id: request.idCustomCommissionRequest,
    requesterName: request.name.trim() || 'Sin nombre',
    emailLabel: request.email.trim(),
    phoneLabel: rawPhone || null,
    datesLabel: formatMyCommissionDatesLabel(request.createdAt, request.expiresAt, dateOptions),
    idea: request.idea.trim() || 'Sin detalle',
    piece: buildCommissionPieceReference(request.idProduct, productName),
  };
}

function renderMyCommissionItem(
  document: Document,
  viewModel: MyCommissionItemViewModel,
): { element: HTMLLIElement; pendingPiece: PendingPieceLink | null } {
  const item = document.createElement('li');
  item.className = 'ui-inbox__item';

  const head = document.createElement('div');
  head.className = 'ui-inbox__head';

  const title = document.createElement('h2');
  title.className = 'ui-inbox__requester';
  title.textContent = `Solicitud #${viewModel.id}`;

  const dates = document.createElement('p');
  dates.className = 'ui-inbox__dates';
  dates.textContent = viewModel.datesLabel;

  head.append(title, dates);

  const meta = document.createElement('div');
  meta.className = 'ui-inbox__meta';

  const contactText = document.createElement('span');
  contactText.className = 'ui-inbox__muted';
  contactText.textContent = `${viewModel.requesterName} · ${viewModel.emailLabel}`;
  meta.append(contactText);

  if (viewModel.phoneLabel) {
    const phoneText = document.createElement('span');
    phoneText.className = 'ui-inbox__phone';
    phoneText.textContent = `Tel: ${viewModel.phoneLabel}`;
    meta.append(phoneText);
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

export async function initializeMyCommissions(
  document: Document,
): Promise<MyCommissionsController> {
  const regionEl = document.getElementById('my-commissions-region');
  const loadingEl = document.getElementById('my-commissions-loading');
  const guestEl = document.getElementById('my-commissions-guest');
  const operationalEl = document.getElementById('my-commissions-operational');
  const errorEl = document.getElementById('my-commissions-error');
  const errorTextEl = document.getElementById('my-commissions-error-text');
  const retryBtn = document.getElementById('my-commissions-retry') as HTMLButtonElement | null;
  const emptyEl = document.getElementById('my-commissions-empty');
  const listEl = document.getElementById('my-commissions-list');

  let activeAttempt = 0;

  const showOnly = (
    state: 'loading' | 'guest' | 'operational' | 'error' | 'empty' | 'list',
  ): void => {
    setHidden(loadingEl, state !== 'loading');
    setHidden(guestEl, state !== 'guest');
    setHidden(operationalEl, state !== 'operational');
    setHidden(errorEl, state !== 'error');
    setHidden(emptyEl, state !== 'empty');
    setHidden(listEl, state !== 'list');
    regionEl?.setAttribute('aria-busy', String(state === 'loading'));
    if (state === 'loading') {
      loadingEl?.setAttribute('aria-busy', 'true');
    } else {
      loadingEl?.removeAttribute('aria-busy');
    }
  };

  const loadCommissions = async (): Promise<void> => {
    if (!loadingEl || !guestEl || !operationalEl || !errorEl || !emptyEl || !listEl) return;

    activeAttempt += 1;
    const attempt = activeAttempt;

    if (retryBtn) retryBtn.disabled = true;
    showOnly('loading');
    listEl.replaceChildren();

    if (isDemoSessionPendingHydration()) {
      await hydrateDemoSession();
    }
    if (attempt !== activeAttempt) return;

    const sessionUser = getSessionUser();
    if (!sessionUser) {
      showOnly('guest');
      if (retryBtn) retryBtn.disabled = false;
      return;
    }

    if (isOperationalRole(sessionUser)) {
      showOnly('operational');
      if (retryBtn) retryBtn.disabled = false;
      return;
    }

    const wasDemo = isDemoSessionActive();
    try {
      const result = await listMyCustomCommissionRequests();
      if (attempt !== activeAttempt) return;

      if (!result.ok) {
        if (result.code === 'UNAUTHENTICATED') {
          if (wasDemo) {
            if (errorTextEl) errorTextEl.textContent = DEMO_EXPIRED_MESSAGE;
            showOnly('error');
          } else {
            showOnly('guest');
          }
          return;
        }
        if (result.code === 'FORBIDDEN') {
          showOnly('operational');
          return;
        }
        if (errorTextEl) errorTextEl.textContent = result.message;
        showOnly('error');
        return;
      }

      if (result.requests.length === 0) {
        showOnly('empty');
        return;
      }

      const pendingPieces: PendingPieceLink[] = [];
      const renderedItems: HTMLLIElement[] = [];

      for (const request of result.requests) {
        const viewModel = buildMyCommissionItemViewModel(request);
        const { element, pendingPiece } = renderMyCommissionItem(document, viewModel);
        renderedItems.push(element);
        if (pendingPiece) pendingPieces.push(pendingPiece);
      }

      const catalogPromise =
        pendingPieces.length > 0
          ? fetchProducts().catch(() => ({
              ok: false as const,
              reason: 'network' as const,
            }))
          : null;

      listEl.replaceChildren(...renderedItems);
      showOnly('list');

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
    } finally {
      if (retryBtn && attempt === activeAttempt) {
        retryBtn.disabled = false;
      }
    }
  };

  retryBtn?.addEventListener('click', () => {
    void loadCommissions();
  });

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onSessionChange = () => {
      void loadCommissions();
    };
    window.addEventListener('session-changed', onSessionChange);
    window.addEventListener(DEMO_SESSION_EVENT, onSessionChange);
  }

  await loadCommissions();

  return { reload: loadCommissions };
}
