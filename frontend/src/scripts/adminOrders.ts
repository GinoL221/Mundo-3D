import { hydrateDemoSession, isDemoSessionActive } from '../config';
import { getSessionUser, hasAdminAccess, isAdminOnly } from '../domains/auth';
import {
  cancelWorkshopOrder,
  confirmWorkshopOrderPayment,
  fetchWorkshopOrders,
  type WorkshopOrderViewModel,
} from '../domains/orders/services/order.service';
import {
  presentWorkshopOrders,
  type WorkshopOrderRow,
} from '../domains/orders/services/orderPresenter';
import { formatPrice } from '../lib/format/price';
import { isDemoSessionPendingHydration } from '../lib/http/demoSessionState';
import { resolveAdminRoleBadge } from './adminCommissionRequestsModel';

const DEMO_EXPIRED_MESSAGE =
  'Tu sesión demo expiró. Iniciá una nueva demo desde la barra superior para continuar.';
const ADMIN_SCOPE_TEXT =
  'Vista operativa de pedidos. Como administrador podés confirmar pagos pendientes o cancelar pedidos (reponiendo el stock de las piezas).';
const STAFF_SCOPE_TEXT =
  'Vista de solo lectura para preparar piezas. Confirmar pagos o cancelar pedidos corresponde al administrador.';

type OrderActionKind = 'confirm-payment' | 'cancel';

interface PendingDialogAction {
  orderId: number;
  orderLabel: string;
  kind: OrderActionKind;
}

export interface AdminOrdersController {
  reload: () => Promise<void>;
}

function setHidden(element: HTMLElement | null, hidden: boolean): void {
  if (!element) return;
  element.hidden = hidden;
}

function renderOrderRow(
  document: Document,
  row: WorkshopOrderRow,
  showActionsColumn: boolean,
  inFlightOrderIds: ReadonlySet<number>,
  onRequestAction: (orderId: number, orderLabel: string, kind: OrderActionKind) => void,
): HTMLTableRowElement {
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

  if (showActionsColumn) {
    const actionsCell = document.createElement('td');
    actionsCell.setAttribute('data-label', 'Acciones');
    actionsCell.className = 'admin-orders__actions';

    if (row.canMutate) {
      const group = document.createElement('div');
      group.className = 'admin-orders__action-group';
      const busy = inFlightOrderIds.has(row.idOrder);

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'ui-btn ui-btn--primary ui-btn--sm admin-order-confirm-btn';
      confirmBtn.textContent = 'Confirmar pago';
      confirmBtn.disabled = busy;
      confirmBtn.addEventListener('click', () => {
        onRequestAction(row.idOrder, row.idOrderLabel, 'confirm-payment');
      });

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'ui-btn ui-btn--danger-soft ui-btn--sm admin-order-cancel-btn';
      cancelBtn.textContent = 'Cancelar pedido';
      cancelBtn.disabled = busy;
      cancelBtn.addEventListener('click', () => {
        onRequestAction(row.idOrder, row.idOrderLabel, 'cancel');
      });

      group.append(confirmBtn, cancelBtn);
      actionsCell.append(group);
    } else {
      const muted = document.createElement('span');
      muted.className = 'admin-orders__action-muted';
      muted.textContent = '—';
      actionsCell.append(muted);
    }

    tr.append(actionsCell);
  }

  return tr;
}

export async function initializeAdminOrders(document: Document): Promise<AdminOrdersController> {
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
  const actionsColEl = document.getElementById('admin-orders-actions-col');
  const listEl = document.getElementById('admin-orders-list');
  const feedbackEl = document.getElementById('admin-orders-feedback');
  const feedbackTextEl = document.getElementById('admin-orders-feedback-text');
  const dialogEl = document.getElementById('admin-order-action-dialog') as HTMLDialogElement | null;
  const dialogTitleEl = document.getElementById('admin-order-dialog-title');
  const dialogBodyEl = document.getElementById('admin-order-dialog-body');
  const dialogConfirmBtn = document.getElementById(
    'admin-order-dialog-confirm',
  ) as HTMLButtonElement | null;

  let activeAttempt = 0;
  let adminCanMutate = false;
  let currentOrders: WorkshopOrderViewModel[] = [];
  const inFlightOrderIds = new Set<number>();
  let pendingDialogAction: PendingDialogAction | null = null;

  const showFeedback = (tone: 'success' | 'danger', message: string): void => {
    if (!feedbackEl || !feedbackTextEl) return;
    feedbackEl.className = `ui-callout ui-callout--${tone}`;
    feedbackEl.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
    feedbackTextEl.textContent = message;
    setHidden(feedbackEl, false);
  };

  const renderRows = (): void => {
    if (!listEl) return;
    const rows = presentWorkshopOrders(currentOrders, formatPrice);
    listEl.replaceChildren(
      ...rows.map((row) =>
        renderOrderRow(document, row, adminCanMutate, inFlightOrderIds, openActionDialog),
      ),
    );
  };

  const executeOrderAction = async (action: PendingDialogAction): Promise<void> => {
    if (inFlightOrderIds.has(action.orderId)) return;
    inFlightOrderIds.add(action.orderId);
    renderRows();

    try {
      const result =
        action.kind === 'confirm-payment'
          ? await confirmWorkshopOrderPayment(action.orderId)
          : await cancelWorkshopOrder(action.orderId);

      if (!result.ok) {
        showFeedback('danger', result.message);
        return;
      }

      currentOrders = currentOrders.map((existing) =>
        existing.idOrder === action.orderId
          ? {
              ...existing,
              status: result.order.status,
              paymentReference: result.order.paymentReference,
            }
          : existing,
      );

      showFeedback(
        'success',
        action.kind === 'confirm-payment'
          ? `Pago confirmado para el pedido ${action.orderLabel}.`
          : `Pedido ${action.orderLabel} cancelado. Se repuso el stock de las piezas.`,
      );
    } finally {
      inFlightOrderIds.delete(action.orderId);
      renderRows();
    }
  };

  const openActionDialog = (orderId: number, orderLabel: string, kind: OrderActionKind): void => {
    if (!adminCanMutate || inFlightOrderIds.has(orderId)) return;
    pendingDialogAction = { orderId, orderLabel, kind };

    if (!dialogEl || typeof dialogEl.showModal !== 'function') {
      const next = pendingDialogAction;
      pendingDialogAction = null;
      void executeOrderAction(next);
      return;
    }

    if (dialogTitleEl) {
      dialogTitleEl.textContent =
        kind === 'confirm-payment'
          ? `Confirmar pago del pedido ${orderLabel}`
          : `Cancelar el pedido ${orderLabel}`;
    }
    if (dialogBodyEl) {
      dialogBodyEl.textContent =
        kind === 'confirm-payment'
          ? 'El pedido pasará a estado confirmado y dejará de estar pendiente de pago.'
          : 'El pedido pasará a estado cancelado y se repondrá automáticamente el stock de todas sus piezas.';
    }
    if (dialogConfirmBtn) {
      dialogConfirmBtn.textContent =
        kind === 'confirm-payment' ? 'Confirmar pago' : 'Cancelar pedido';
      dialogConfirmBtn.className =
        kind === 'confirm-payment'
          ? 'ui-btn ui-btn--primary ui-btn--sm'
          : 'ui-btn ui-btn--danger ui-btn--sm';
    }

    dialogEl.returnValue = '';
    dialogEl.showModal();
  };

  dialogEl?.addEventListener('close', () => {
    const choice = dialogEl.returnValue;
    dialogEl.returnValue = '';
    const action = pendingDialogAction;
    pendingDialogAction = null;
    if (choice === 'confirm' && action) {
      void executeOrderAction(action);
    }
  });

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
    setHidden(feedbackEl, true);
    listEl.replaceChildren();

    const wasDemo = isDemoSessionActive();
    let unauthorized = false;
    try {
      const result = await fetchWorkshopOrders();
      if (attempt !== activeAttempt) return;

      if (!result.ok) {
        if (result.code === 'UNAUTHENTICATED' && !wasDemo) {
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

      currentOrders = result.orders;
      if (currentOrders.length === 0) {
        setHidden(emptyEl, false);
        return;
      }

      renderRows();
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

  adminCanMutate = isAdminOnly(sessionUser);
  setHidden(actionsColEl, !adminCanMutate);
  if (scopeNote) {
    scopeNote.textContent = adminCanMutate ? ADMIN_SCOPE_TEXT : STAFF_SCOPE_TEXT;
    setHidden(scopeNote, false);
  }

  const badge = resolveAdminRoleBadge(sessionUser);
  if (roleBadge && badge) {
    roleBadge.textContent = badge.label;
    roleBadge.className = `ui-badge ${badge.modifierClass}`;
    setHidden(roleBadge, false);
  }
  setHidden(deniedEl, true);
  setHidden(contentEl, false);

  retryBtn?.addEventListener('click', () => {
    void loadOrders();
  });

  await loadOrders();

  return { reload: loadOrders };
}
