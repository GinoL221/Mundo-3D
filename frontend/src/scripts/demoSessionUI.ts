import {
  checkDemoAvailability,
  DEMO_BROADCAST_CHANNEL,
  DEMO_SESSION_EVENT,
  endDemoSession,
  getDemoSession,
  hydrateDemoSession,
  isDemoSessionActive,
  startDemoSession,
  switchDemoRole,
  type DemoChangeReason,
  type DemoRole,
  type DemoSessionChangedMessage,
} from '../config';
import {
  DEMO_TAB_ID,
  expireDemoCsrfCookie,
  persistDemoSession,
} from '../lib/http/demoSessionState';
import { CartService } from '../domains/cart/services/CartService';
import { DEMO_CART_STORAGE_KEY } from '../domains/cart/services/cartState';
import {
  hideDemoNotice,
  queryDemoBarElements,
  queryDemoEntryButtons,
  renderDemoBar,
  setDemoEntriesBusy,
  setDemoEntriesVisibility,
  setDemoRoleSwitchBusy,
  showDemoNotice,
} from './demoSessionDom';
import { buildDemoNotice, isDemoProtectedPath } from './demoSessionModel';

type Cleanup = () => void;

const cleanups = new WeakMap<Document, Cleanup>();
const DEFAULT_CART_HYDRATION_TIMEOUT_MS = 1500;

function clearDemoCartCache(): void {
  try {
    localStorage.removeItem(DEMO_CART_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

async function hydrateCartWithTimeout(timeoutMs: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      CartService.hydrateFromServer().catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export interface DemoSessionUIOptions {
  reloadOnTransition?: boolean;
  cartHydrationTimeoutMs?: number;
}

export function initializeDemoSessionUI(
  document: Document,
  window: Window,
  options: DemoSessionUIOptions = {},
): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;

  const reloadOnTransition = options.reloadOnTransition ?? true;
  const cartHydrationTimeoutMs =
    options.cartHydrationTimeoutMs ?? DEFAULT_CART_HYDRATION_TIMEOUT_MS;
  const els = queryDemoBarElements(document);
  let demoAvailable = false;
  let starting = false;
  let switchingRole = false;
  let syncVersion = 0;

  const handleTransitionReload = (redirectHome = false): void => {
    if (!reloadOnTransition) return;
    const pathname = window.location?.pathname ?? '/';
    if (redirectHome || pathname === '/login') {
      if (typeof window.location?.assign === 'function') window.location.assign('/');
      return;
    }
    if (typeof window.location?.reload === 'function') window.location.reload();
  };

  const handleStart = async (): Promise<void> => {
    if (starting) return;
    starting = true;
    hideDemoNotice(els);
    setDemoEntriesBusy(document, els, true);
    try {
      const result = await startDemoSession();
      if (result.ok) {
        syncVersion += 1;
        demoAvailable = true;
        renderDemoBar(document, els, result.session, demoAvailable);
        clearDemoCartCache();
        CartService.loadCartFromStorage();
        await hydrateCartWithTimeout(cartHydrationTimeoutMs);
        window.dispatchEvent(new Event('session-changed'));
        handleTransitionReload(false);
        return;
      }
      if (result.reason === 'disabled') {
        demoAvailable = false;
        setDemoEntriesVisibility(document, false);
      }
      showDemoNotice(els, buildDemoNotice(result.reason, result.retryAfterSeconds));
    } finally {
      starting = false;
      setDemoEntriesBusy(document, els, false);
    }
  };

  const handleRoleSwitch = async (targetRole: DemoRole): Promise<void> => {
    if (switchingRole) return;
    const current = getDemoSession();
    if (!current || current.role === targetRole) return;
    switchingRole = true;
    hideDemoNotice(els);
    setDemoRoleSwitchBusy(els, true);
    try {
      const result = await switchDemoRole(targetRole);
      if (result.ok) {
        syncVersion += 1;
        renderDemoBar(document, els, result.session, demoAvailable);
        window.dispatchEvent(new Event('session-changed'));
        const pathname = window.location?.pathname ?? '/';
        const leaveAdmin = targetRole === 'USER' && pathname.startsWith('/admin');
        handleTransitionReload(leaveAdmin);
        return;
      }
      if (result.reason === 'expired' || result.reason === 'disabled') {
        handleReason(result.reason);
        return;
      }
      showDemoNotice(els, buildDemoNotice('error'));
    } finally {
      switchingRole = false;
      setDemoRoleSwitchBusy(els, false);
    }
  };

  const handleExit = async (): Promise<void> => {
    if (els.exitBtn) {
      els.exitBtn.disabled = true;
      els.exitBtn.setAttribute('aria-busy', 'true');
    }
    try {
      syncVersion += 1;
      hideDemoNotice(els);
      clearDemoCartCache();
      await endDemoSession();
      CartService.loadCartFromStorage();
      renderDemoBar(document, els, null, demoAvailable);
      window.dispatchEvent(new Event('session-changed'));
      handleTransitionReload(isDemoProtectedPath(window.location?.pathname ?? '/'));
    } finally {
      if (els.exitBtn) {
        els.exitBtn.disabled = false;
        els.exitBtn.removeAttribute('aria-busy');
      }
    }
  };

  const handleReason = (reason: DemoChangeReason | undefined, fromBroadcast = false): void => {
    if (reason === 'expired' || reason === 'disabled' || reason === 'ended') {
      syncVersion += 1;
      if (fromBroadcast) {
        expireDemoCsrfCookie();
        persistDemoSession(null);
      }
      clearDemoCartCache();
      CartService.loadCartFromStorage();
      if (reason === 'expired') demoAvailable = true;
      if (reason === 'disabled') demoAvailable = false;
      renderDemoBar(document, els, null, demoAvailable);
      if (reason !== 'ended') showDemoNotice(els, buildDemoNotice(reason));
      window.dispatchEvent(new Event('session-changed'));
      return;
    }
    if (
      fromBroadcast &&
      (reason === 'started' || reason === 'updated' || reason === 'role-changed')
    ) {
      const version = ++syncVersion;
      void (async () => {
        const hydrated = await hydrateDemoSession();
        if (version !== syncVersion) return;
        if (hydrated.status === 'active') {
          demoAvailable = true;
          renderDemoBar(document, els, hydrated.session, demoAvailable);
          window.dispatchEvent(new Event('session-changed'));
        } else if (hydrated.status === 'inactive') {
          persistDemoSession(null);
          renderDemoBar(document, els, null, demoAvailable);
          window.dispatchEvent(new Event('session-changed'));
        }
      })();
      return;
    }
    renderDemoBar(document, els, getDemoSession(), demoAvailable);
  };

  const onEntryClick = (event: Event): void => {
    event.preventDefault();
    void handleStart();
  };
  const onExitClick = (event: Event): void => {
    event.preventDefault();
    void handleExit();
  };
  const onBuyerRoleClick = (event: Event): void => {
    event.preventDefault();
    void handleRoleSwitch('USER');
  };
  const onStaffRoleClick = (event: Event): void => {
    event.preventDefault();
    void handleRoleSwitch('STAFF');
  };
  const onDismissClick = (): void => hideDemoNotice(els);
  const onDemoEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ reason?: DemoChangeReason }>).detail;
    handleReason(detail?.reason);
  };

  const entries = queryDemoEntryButtons(document);
  for (const btn of entries) btn.addEventListener('click', onEntryClick);
  els.retryBtn?.addEventListener('click', onEntryClick);
  els.buyerBtn?.addEventListener('click', onBuyerRoleClick);
  els.staffBtn?.addEventListener('click', onStaffRoleClick);
  els.exitBtn?.addEventListener('click', onExitClick);
  els.dismissBtn?.addEventListener('click', onDismissClick);
  window.addEventListener(DEMO_SESSION_EVENT, onDemoEvent);

  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(DEMO_BROADCAST_CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        const msg = event?.data as Partial<DemoSessionChangedMessage> | undefined;
        if (msg?.senderId === DEMO_TAB_ID) return;
        handleReason(msg?.reason, true);
      };
    }
  } catch {
    channel = null;
  }

  const startupVersion = syncVersion;
  void (async () => {
    if (isDemoSessionActive()) {
      renderDemoBar(document, els, getDemoSession(), demoAvailable);
      const hydrated = await hydrateDemoSession();
      if (startupVersion !== syncVersion) return;
      if (hydrated.status === 'active') {
        demoAvailable = true;
        renderDemoBar(document, els, hydrated.session, demoAvailable);
        window.dispatchEvent(new Event('session-changed'));
      } else if (hydrated.status === 'inactive') {
        persistDemoSession(null);
        if (entries.length > 0) demoAvailable = await checkDemoAvailability();
        if (startupVersion !== syncVersion) return;
        renderDemoBar(document, els, null, demoAvailable);
      } else if (hydrated.status === 'error') {
        if (entries.length > 0) demoAvailable = await checkDemoAvailability();
        if (startupVersion !== syncVersion) return;
        renderDemoBar(document, els, getDemoSession(), demoAvailable);
      }
      return;
    }
    if (entries.length === 0) return;
    demoAvailable = await checkDemoAvailability();
    if (startupVersion !== syncVersion) return;
    renderDemoBar(document, els, null, demoAvailable);
  })();

  let active = true;
  const cleanup = (): void => {
    if (!active) return;
    active = false;
    for (const btn of entries) btn.removeEventListener('click', onEntryClick);
    els.retryBtn?.removeEventListener('click', onEntryClick);
    els.buyerBtn?.removeEventListener('click', onBuyerRoleClick);
    els.staffBtn?.removeEventListener('click', onStaffRoleClick);
    els.exitBtn?.removeEventListener('click', onExitClick);
    els.dismissBtn?.removeEventListener('click', onDismissClick);
    window.removeEventListener(DEMO_SESSION_EVENT, onDemoEvent);
    channel?.close();
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
