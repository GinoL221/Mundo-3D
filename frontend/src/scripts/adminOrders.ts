import { hydrateDemoSession, isDemoSessionActive } from '../config';
import { getSessionUser, hasAdminAccess } from '../domains/auth';
import { fetchWorkshopOrders } from '../domains/orders/services/order.service';
import {
  presentWorkshopOrders,
  type WorkshopOrderRow,
} from '../domains/orders/services/orderPresenter';
import { formatPrice } from '../lib/format/price';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';
import { resolveAdminRoleBadge } from './adminCommissionRequestsModel';

const DEMO_EXPIRED_MESSAGE =
  'Tu sesión demo expiró. Iniciá una nueva demo desde la barra superior para continuar.';

export interface AdminOrdersController {
  reload: () => Promise<void>;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.hidden = hidden;
}

function renderOrderRow(document: Document, row: WorkshopOrderRow): HTMLTableRowElement {
  const tr = document.createElement('tr');
  tr.className = 'admin-order-row';

  const idCell = document.createElement('th');
  idCell.setAttribute('scope', 'row');
  idCell.setAttribute('data-label', 'Pedido');
  idCell.className = 'admin-orders__id';
  idCell.textContent = row.idOrderLabel;

  const dateCell = document.createElement('td');
  dateCell.setAttribute('data-label', 'Fecha');
  dateCell.className = 'admin-orders__date';
  dateCell.textContent = row.createdAtLabel;

  const customerCell = document.createElement('td');
  customerCell.setAttribute('data-label', 'Cliente');
  customerCell.className = 'admin-orders__customer';
  customerCell.textContent = row.customerLabel;

  const statusCell = document.createElement('td');
  statusCell.setAttribute('data-label', 'Estado');
  const badge = document.createElement('span');
  badge.className = `ui-badge ${row.statusBadgeClass}`;
  badge.textContent = row.statusLabel;
  statusCell.append(badge);

  const itemsCell = document.createElement('td');
  itemsCell.setAttribute('data-label', 'Piezas');
  const details = document.createElement('details');
  details.className = 'admin-orders__details';
  const summary = document.createElement('summary');
  summary.className = 'admin-orders__summary';
  summary.textContent = row.itemsCountLabel;
  const list = document.createElement('ul');
  list.className = 'admin-orders__item-list';

  for (const item of row.items) {
    const li = document.createElement('li');
    li.className = 'admin-orders__item';
    const qty = document.createElement('span');
    qty.className = 'admin-orders__item-qty';
    qty.textContent = `${item.quantityLabel}×`;
    li.append(qty);

    if (item.productHref) {
      const link = document.createElement('a');
      link.className = 'admin-orders__item-link';
      link.href = item.productHref;
      link.textContent = item.productName;
      li.append(link);
    } else {
      const name = document.createElement('span');
      name.textContent = item.productName;
      li.append(name);
    }

    const subtotal = document.createElement('span');
    subtotal.className = 'admin-orders__item-subtotal';
    subtotal.textContent = item.subtotalLabel;
    li.append(subtotal);

    list.append(li);
  }
  details.append(summary, list);
  itemsCell.append(details);

  const totalCell = document.createElement('td');
  totalCell.setAttribute('data-label', 'Total');
  totalCell.className = 'ui-table__num admin-orders__total';
  totalCell.textContent = row.totalLabel;

  tr.append(idCell, dateCell, customerCell, statusCell, itemsCell, totalCell);
  return tr;
}

export async function initializeAdminOrders(
  document: Document,
): Promise<AdminOrdersController> {
  const roleBadge = document.getElementById('admin-role-badge');
  const scopeNote = document.getElementById('admin-orders-scope');
  const deniedEl = document.getElementById('admin-gate-denied');
  const contentEl = document.getElementById('admin-orders-content');
  const loadingEl = document.getElementById('admin-orders-loading');
  const errorEl = document.getElementById('admin-orders-error');
  const errorTextEl = document.getElementById('admin-orders-error-text');
  const retryBtn = document.getElementById('admin-orders-retry') as HTMLButtonElement | null;
  const emptyEl = document.getElementById('admin-orders-empty');
  const tableWrapEl = document.getElementById('admin-orders-table-wrap');
  const listEl = document.getElementById('admin-orders-list');

  let activeAttempt = 0;

  const loadOrders = async (): Promise<void> => {
    if (!loadingEl || !errorEl || !emptyEl || !tableWrapEl || !listEl) return;

    activeAttempt += 1;
    const attempt = activeAttempt;

    if (retryBtn) retryBtn.disabled = true;
    loadingEl.setAttribute('aria-busy', 'true');
    setHidden(loadingEl, false);
    setHidden(errorEl, true);
    setHidden(emptyEl, true);
    setHidden(tableWrapEl, true);
    listEl.replaceChildren();

    const wasDemo = isDemoSessionActive();
    let unauthorized = false;
    try {
      const result = await fetchWorkshopOrders();
      if (attempt !== activeAttempt) return;

      if (!result.ok) {
        if (result.code === 'UNAUTHENTICATED' && !wasDemo) {
          // authFetch already handles 401 teardown and /login redirect.
          unauthorized = true;
          return;
        }
        loadingEl.removeAttribute('aria-busy');
        setHidden(loadingEl, true);
        if (errorTextEl) {
          errorTextEl.textContent =
            result.code === 'UNAUTHENTICATED' ? DEMO_EXPIRED_MESSAGE : result.message;
        }
        setHidden(errorEl, false);
        return;
      }

      loadingEl.removeAttribute('aria-busy');
      setHidden(loadingEl, true);

      if (result.orders.length === 0) {
        setHidden(emptyEl, false);
        return;
      }

      const rows = presentWorkshopOrders(result.orders, formatPrice);
      listEl.replaceChildren(...rows.map((row) => renderOrderRow(document, row)));
      setHidden(tableWrapEl, false);
    } finally {
      if (!unauthorized && retryBtn && attempt === activeAttempt) {
        retryBtn.disabled = false;
      }
    }
  };

  let sessionUser = getSessionUser();
  if (!hasAdminAccess(sessionUser) && isDemoSessionPendingHydration()) {
    await hydrateDemoSession();
    sessionUser = getSessionUser();
  }
  if (!hasAdminAccess(sessionUser)) {
    setHidden(roleBadge, true);
    setHidden(scopeNote, true);
    setHidden(contentEl, true);
    setHidden(deniedEl, false);
    return { reload: loadOrders };
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
    void loadOrders();
  });

  await loadOrders();

  return { reload: loadOrders };
}
