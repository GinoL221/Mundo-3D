import { afterEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../domains/auth/adapters/auth.adapter';

const mockGetSessionUser = vi.fn();
const mockHydrateDemoSession = vi.fn();
const mockIsDemoSessionActive = vi.fn();
const mockIsDemoSessionPendingHydration = vi.fn();
const mockFetchWorkshopOrders = vi.fn();
const mockConfirmWorkshopOrderPayment = vi.fn();
const mockCancelWorkshopOrder = vi.fn();

vi.mock('../domains/auth', () => ({
  getSessionUser: () => mockGetSessionUser(),
  hasAdminAccess: (user: { idRole: number } | null) =>
    user?.idRole === Role.ADMIN || user?.idRole === Role.STAFF,
  isAdminOnly: (user: { idRole: number } | null) => user?.idRole === Role.ADMIN,
}));

vi.mock('../config', () => ({
  hydrateDemoSession: () => mockHydrateDemoSession(),
  isDemoSessionActive: () => mockIsDemoSessionActive(),
}));

vi.mock('../lib/http/demoSessionState', () => ({
  isDemoSessionPendingHydration: () => mockIsDemoSessionPendingHydration(),
}));

vi.mock('../domains/orders/services/order.service', () => ({
  fetchWorkshopOrders: () => mockFetchWorkshopOrders(),
  confirmWorkshopOrderPayment: (id: number) => mockConfirmWorkshopOrderPayment(id),
  cancelWorkshopOrder: (id: number) => mockCancelWorkshopOrder(id),
}));

import { initializeAdminOrders } from './adminOrders';

class FakeEl {
  tagName: string;
  hidden = false;
  disabled = false;
  className = '';
  textContent = '';
  href = '';
  type = '';
  value = '';
  returnValue = '';
  open = false;
  attrs = new Map<string, string>();
  children: FakeEl[] = [];
  listeners = new Map<string, Set<EventListener>>();

  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
  }

  showModal() {
    this.open = true;
  }
  close(val = '') {
    this.open = false;
    this.returnValue = val;
    this.listeners.get('close')?.forEach((fn) => fn({} as Event));
  }
  setAttribute(name: string, value: string) {
    this.attrs.set(name, value);
  }
  removeAttribute(name: string) {
    this.attrs.delete(name);
  }
  append(...nodes: FakeEl[]) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes: FakeEl[]) {
    this.children = [...nodes];
  }
  addEventListener(type: string, fn: EventListener) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(fn);
    this.listeners.set(type, set);
  }
  click() {
    this.listeners.get('click')?.forEach((fn) => fn({} as Event));
  }
  findButtons(): FakeEl[] {
    const own = this.tagName === 'BUTTON' ? [this] : [];
    return [...own, ...this.children.flatMap((c) => c.findButtons())];
  }
  collectText(): string {
    return [this.textContent, ...this.children.map((c) => c.collectText())]
      .filter(Boolean)
      .join(' ');
  }
  collectTags(): string[] {
    return [this.tagName, ...this.children.flatMap((c) => c.collectTags())];
  }
}

function createFakeDocument() {
  const byId = new Map<string, FakeEl>([
    ['admin-role-badge', new FakeEl('span')],
    ['admin-orders-scope', new FakeEl('p')],
    ['admin-gate-denied', new FakeEl('div')],
    ['admin-orders-content', new FakeEl('section')],
    ['admin-orders-loading', new FakeEl('div')],
    ['admin-orders-error', new FakeEl('div')],
    ['admin-orders-error-text', new FakeEl('p')],
    ['admin-orders-retry', new FakeEl('button')],
    ['admin-orders-empty', new FakeEl('div')],
    ['admin-orders-table-wrap', new FakeEl('div')],
    ['admin-orders-actions-col', new FakeEl('th')],
    ['admin-orders-list', new FakeEl('tbody')],
    ['admin-orders-feedback', new FakeEl('div')],
    ['admin-orders-feedback-text', new FakeEl('p')],
    ['admin-order-action-dialog', new FakeEl('dialog')],
    ['admin-order-dialog-title', new FakeEl('h2')],
    ['admin-order-dialog-body', new FakeEl('p')],
    ['admin-order-dialog-confirm', new FakeEl('button')],
  ]);
  byId.get('admin-gate-denied')!.hidden = true;
  byId.get('admin-orders-content')!.hidden = true;
  byId.get('admin-orders-error')!.hidden = true;
  byId.get('admin-orders-empty')!.hidden = true;
  byId.get('admin-orders-table-wrap')!.hidden = true;
  byId.get('admin-orders-actions-col')!.hidden = true;
  byId.get('admin-orders-feedback')!.hidden = true;

  const doc = {
    getElementById: (id: string) => byId.get(id) ?? null,
    createElement: (tag: string) => new FakeEl(tag),
  } as unknown as Document;

  return { doc, byId };
}

describe('initializeAdminOrders', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows AdminGateDenied and skips API fetch for a regular USER', async () => {
    mockGetSessionUser.mockReturnValue({ idRole: Role.USER });
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    const { doc, byId } = createFakeDocument();

    await initializeAdminOrders(doc);

    expect(byId.get('admin-gate-denied')!.hidden).toBe(false);
    expect(byId.get('admin-orders-content')!.hidden).toBe(true);
    expect(mockFetchWorkshopOrders).not.toHaveBeenCalled();
  });

  it('renders read-only orders for STAFF with customer displayName and zero action buttons or email', async () => {
    mockGetSessionUser.mockReturnValue({ idRole: Role.STAFF });
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    mockIsDemoSessionActive.mockReturnValue(true);
    mockFetchWorkshopOrders.mockResolvedValue({
      ok: true,
      orders: [
        {
          idOrder: 1,
          idUser: 1,
          status: 'AWAITING_PAYMENT',
          totalAmount: 19500,
          createdAt: '2026-01-01T12:00:00.000Z',
          paymentReference: 'SECRET-PAY-REF',
          customer: { idUser: 1, displayName: 'Demo B.' },
          items: [
            {
              idOrderItem: 1,
              idProduct: 1,
              productName: 'Busto Batman',
              quantity: 1,
              unitPrice: 19500,
              subtotal: 19500,
            },
          ],
        },
      ],
    });
    const { doc, byId } = createFakeDocument();

    await initializeAdminOrders(doc);

    expect(byId.get('admin-role-badge')!.textContent).toBe('STAFF');
    expect(byId.get('admin-orders-table-wrap')!.hidden).toBe(false);
    const tbody = byId.get('admin-orders-list')!;
    expect(tbody.children).toHaveLength(1);
    const rowText = tbody.collectText();
    expect(rowText).toContain('#1');
    expect(rowText).toContain('Demo B. · #1');
    expect(rowText).toContain('Busto Batman');
    expect(rowText).toContain('1 pieza');
    expect(rowText).not.toContain('SECRET-PAY-REF');
    expect(rowText).not.toContain('@');
    expect(tbody.collectTags()).not.toContain('BUTTON');
  });

  it('shows empty state when there are no orders and handles 403/network errors with retry', async () => {
    mockGetSessionUser.mockReturnValue({ idRole: Role.STAFF });
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    mockIsDemoSessionActive.mockReturnValue(false);
    mockFetchWorkshopOrders
      .mockResolvedValueOnce({ ok: false, code: 'FORBIDDEN', message: 'Sin permisos.' })
      .mockResolvedValueOnce({ ok: true, orders: [] });
    const { doc, byId } = createFakeDocument();

    const controller = await initializeAdminOrders(doc);
    expect(byId.get('admin-orders-error')!.hidden).toBe(false);
    expect(byId.get('admin-orders-error-text')!.textContent).toContain('Sin permisos');

    await controller.reload();
    expect(byId.get('admin-orders-error')!.hidden).toBe(true);
    expect(byId.get('admin-orders-empty')!.hidden).toBe(false);
  });

  it('shows confirm-payment and cancel actions only for ADMIN on AWAITING_PAYMENT orders and executes via dialog', async () => {
    mockGetSessionUser.mockReturnValue({ idRole: Role.ADMIN });
    mockIsDemoSessionPendingHydration.mockReturnValue(false);
    mockIsDemoSessionActive.mockReturnValue(false);
    const awaitingOrder = {
      idOrder: 7,
      idUser: 1,
      status: 'AWAITING_PAYMENT',
      totalAmount: 19500,
      createdAt: '2026-01-01T12:00:00.000Z',
      paymentReference: null,
      customer: { idUser: 1, displayName: 'Gino L.' },
      items: [
        {
          idOrderItem: 1,
          idProduct: 1,
          productName: 'Busto Batman',
          quantity: 1,
          unitPrice: 19500,
          subtotal: 19500,
        },
      ],
    };
    const paidOrder = { ...awaitingOrder, idOrder: 8, status: 'PAID' };
    mockFetchWorkshopOrders.mockResolvedValue({ ok: true, orders: [awaitingOrder, paidOrder] });
    mockConfirmWorkshopOrderPayment.mockResolvedValue({
      ok: true,
      order: { ...awaitingOrder, status: 'PAID' },
    });

    const { doc, byId } = createFakeDocument();
    await initializeAdminOrders(doc);

    expect(byId.get('admin-role-badge')!.textContent).toBe('ADMIN');
    expect(byId.get('admin-orders-actions-col')!.hidden).toBe(false);

    const tbody = byId.get('admin-orders-list')!;
    const buttons = tbody.findButtons();
    expect(buttons.map((b) => b.textContent)).toEqual(['Confirmar pago', 'Cancelar pedido']);

    const dialog = byId.get('admin-order-action-dialog')!;
    buttons[0].click();
    expect(dialog.open).toBe(true);
    // Cancelling dialog does not call API
    dialog.close('cancel');
    await new Promise((r) => setTimeout(r, 0));
    expect(mockConfirmWorkshopOrderPayment).not.toHaveBeenCalled();

    // Confirming calls confirmWorkshopOrderPayment and updates row state
    buttons[0].click();
    dialog.close('confirm');
    await new Promise((r) => setTimeout(r, 0));
    expect(mockConfirmWorkshopOrderPayment).toHaveBeenCalledWith(7);
    expect(byId.get('admin-orders-feedback')!.hidden).toBe(false);
    expect(tbody.findButtons()).toHaveLength(0);
  });
});
