import {
  checkDemoAvailability,
  DEMO_BROADCAST_CHANNEL,
  DEMO_SESSION_EVENT,
  endDemoSession,
  getDemoSession,
  hydrateDemoSession,
  isDemoSessionActive,
  startDemoSession,
  type DemoChangeReason,
  type DemoSessionChangedMessage,
} from '../config';
import { CartService } from '../domains/cart/services/CartService';
import { DEMO_CART_STORAGE_KEY } from '../domains/cart/services/cartState';
import {
  hideDemoNotice,
  queryDemoBarElements,
  queryDemoEntryButtons,
  renderDemoBar,
  setDemoEntriesBusy,
  setDemoEntriesVisibility,
  showDemoNotice,
} from './demoSessionDom';
import { buildDemoNotice, isDemoProtectedPath } from './demoSessionModel';

type Cleanup = () => void;

const cleanups = new WeakMap<Document, Cleanup>();

function clearDemoCartCache(): void {
  try {
    localStorage.removeItem(DEMO_CART_STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export interface DemoSessionUIOptions {
  reloadOnTransition?: boolean;
}

export function initializeDemoSessionUI(
  document: Document,
  window: Window,
  options: DemoSessionUIOptions = {},
): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;

  const reloadOnTransition = options.reloadOnTransition ?? true;
  const els = queryDemoBarElements(document);
  let demoAvailable = false;
  let starting = false;

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
        demoAvailable = true;
        renderDemoBar(document, els, result.session, demoAvailable);
        CartService.loadCartFromStorage();
        void CartService.hydrateFromServer();
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

  const handleExit = async (): Promise<void> => {
    if (els.exitBtn) els.exitBtn.disabled = true;
    hideDemoNotice(els);
    clearDemoCartCache();
    await endDemoSession();
    CartService.loadCartFromStorage();
    renderDemoBar(document, els, null, demoAvailable);
    window.dispatchEvent(new Event('session-changed'));
    handleTransitionReload(isDemoProtectedPath(window.location?.pathname ?? '/'));
    if (els.exitBtn) els.exitBtn.disabled = false;
  };

  const handleReason = (reason: DemoChangeReason | undefined): void => {
    if (reason === 'expired' || reason === 'disabled' || reason === 'ended') {
      clearDemoCartCache();
      CartService.loadCartFromStorage();
      if (reason === 'expired') demoAvailable = true;
      if (reason === 'disabled') demoAvailable = false;
      renderDemoBar(document, els, null, demoAvailable);
      if (reason !== 'ended') showDemoNotice(els, buildDemoNotice(reason));
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
  const onDismissClick = (): void => hideDemoNotice(els);
  const onDemoEvent = (event: Event): void => {
    const detail = (event as CustomEvent<{ reason?: DemoChangeReason }>).detail;
    handleReason(detail?.reason);
  };

  const entries = queryDemoEntryButtons(document);
  for (const btn of entries) btn.addEventListener('click', onEntryClick);
  els.retryBtn?.addEventListener('click', onEntryClick);
  els.exitBtn?.addEventListener('click', onExitClick);
  els.dismissBtn?.addEventListener('click', onDismissClick);
  window.addEventListener(DEMO_SESSION_EVENT, onDemoEvent);

  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(DEMO_BROADCAST_CHANNEL);
      channel.onmessage = (event: MessageEvent) => {
        const msg = event?.data as Partial<DemoSessionChangedMessage> | undefined;
        handleReason(msg?.reason);
      };
    }
  } catch {
    channel = null;
  }

  void (async () => {
    if (isDemoSessionActive()) {
      renderDemoBar(document, els, getDemoSession(), demoAvailable);
      const hydrated = await hydrateDemoSession();
      if (hydrated.status === 'active') {
        demoAvailable = true;
        renderDemoBar(document, els, hydrated.session, demoAvailable);
        window.dispatchEvent(new Event('session-changed'));
      }
      return;
    }
    if (entries.length === 0) return;
    demoAvailable = await checkDemoAvailability();
    renderDemoBar(document, els, null, demoAvailable);
  })();

  let active = true;
  const cleanup = (): void => {
    if (!active) return;
    active = false;
    for (const btn of entries) btn.removeEventListener('click', onEntryClick);
    els.retryBtn?.removeEventListener('click', onEntryClick);
    els.exitBtn?.removeEventListener('click', onExitClick);
    els.dismissBtn?.removeEventListener('click', onDismissClick);
    window.removeEventListener(DEMO_SESSION_EVENT, onDemoEvent);
    channel?.close();
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
