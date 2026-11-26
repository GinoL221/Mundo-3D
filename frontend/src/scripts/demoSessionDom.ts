import { getSessionUser, type DemoSessionState } from '../config';
import { buildDemoBarPresentation, type DemoNoticePresentation } from './demoSessionModel';

export interface DemoBarElements {
  bar: HTMLElement | null;
  roleBadge: HTMLElement | null;
  summary: HTMLElement | null;
  roleControls: HTMLElement | null;
  buyerBtn: HTMLButtonElement | null;
  staffBtn: HTMLButtonElement | null;
  adminBtn: HTMLButtonElement | null;
  exitBtn: HTMLButtonElement | null;
  noticeWrap: HTMLElement | null;
  noticeEl: HTMLElement | null;
  noticeTitle: HTMLElement | null;
  noticeText: HTMLElement | null;
  retryBtn: HTMLButtonElement | null;
  dismissBtn: HTMLButtonElement | null;
}

export function queryDemoBarElements(document: Document): DemoBarElements {
  return {
    bar: document.getElementById('demo-session-bar'),
    roleBadge: document.getElementById('demo-bar-role-badge'),
    summary: document.getElementById('demo-bar-summary'),
    roleControls: document.getElementById('demo-bar-role-controls'),
    buyerBtn: document.getElementById('demo-role-buyer') as HTMLButtonElement | null,
    staffBtn: document.getElementById('demo-role-staff') as HTMLButtonElement | null,
    adminBtn: document.getElementById('demo-role-admin') as HTMLButtonElement | null,
    exitBtn: document.getElementById('demo-bar-exit') as HTMLButtonElement | null,
    noticeWrap: document.getElementById('demo-session-notice-wrap'),
    noticeEl: document.getElementById('demo-session-notice'),
    noticeTitle: document.getElementById('demo-notice-title'),
    noticeText: document.getElementById('demo-notice-text'),
    retryBtn: document.getElementById('demo-notice-retry') as HTMLButtonElement | null,
    dismissBtn: document.getElementById('demo-notice-dismiss') as HTMLButtonElement | null,
  };
}

export function queryDemoEntryButtons(document: Document): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[data-demo-entry]'));
}

export function setDemoEntriesVisibility(document: Document, visible: boolean): void {
  const user = getSessionUser();
  const hasStandardSession = Boolean(user && !user.isDemo);
  for (const btn of queryDemoEntryButtons(document)) {
    btn.hidden = !visible || (btn.hasAttribute('data-demo-guest-only') && hasStandardSession);
  }
}

export function setDemoEntriesBusy(document: Document, els: DemoBarElements, busy: boolean): void {
  for (const btn of queryDemoEntryButtons(document)) {
    btn.disabled = busy;
    btn.setAttribute('aria-busy', String(busy));
  }
  if (els.retryBtn) {
    els.retryBtn.disabled = busy;
    els.retryBtn.setAttribute('aria-busy', String(busy));
  }
}

export function hideDemoNotice(els: DemoBarElements): void {
  if (els.noticeWrap) els.noticeWrap.hidden = true;
}

export function showDemoNotice(els: DemoBarElements, notice: DemoNoticePresentation): void {
  if (!els.noticeWrap || !els.noticeEl) return;
  els.noticeEl.className = `ui-callout ui-callout--${notice.tone} demo-notice`;
  if (els.noticeTitle) els.noticeTitle.textContent = notice.title;
  if (els.noticeText) els.noticeText.textContent = notice.text;
  if (els.retryBtn) {
    els.retryBtn.hidden = !notice.retryLabel;
    if (notice.retryLabel) els.retryBtn.textContent = notice.retryLabel;
  }
  els.noticeWrap.hidden = false;
  if (typeof els.noticeEl.focus === 'function') els.noticeEl.focus();
}

export function setDemoRoleSwitchBusy(els: DemoBarElements, busy: boolean): void {
  for (const btn of [els.buyerBtn, els.staffBtn, els.adminBtn, els.exitBtn]) {
    if (!btn) continue;
    btn.disabled = busy;
    btn.setAttribute('aria-busy', String(busy));
  }
}

export function renderDemoBar(
  document: Document,
  els: DemoBarElements,
  session: DemoSessionState | null,
  demoAvailable: boolean,
): void {
  if (!els.bar) return;
  if (!session) {
    els.bar.hidden = true;
    if (els.roleControls) els.roleControls.hidden = true;
    setDemoEntriesVisibility(document, demoAvailable);
    return;
  }
  const presentation = buildDemoBarPresentation(session.role);
  els.bar.hidden = false;
  setDemoEntriesVisibility(document, false);
  if (els.roleBadge) {
    els.roleBadge.textContent = presentation.roleLabel;
    els.roleBadge.className = presentation.roleBadgeClass;
  }
  if (els.summary) els.summary.textContent = presentation.summaryText;
  if (els.roleControls) els.roleControls.hidden = false;
  els.buyerBtn?.setAttribute('aria-pressed', String(session.role === 'USER'));
  els.staffBtn?.setAttribute('aria-pressed', String(session.role === 'STAFF'));
  els.adminBtn?.setAttribute('aria-pressed', String(session.role === 'ADMIN'));
}
