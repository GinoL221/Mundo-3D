type Cleanup = () => void;

const cleanups = new WeakMap<Document, Cleanup>();

export function initializeHomeMenu(document: Document): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;

  const toggle = document.getElementById('home-menu-toggle') as HTMLButtonElement | null;
  const menu = document.getElementById('home-primary-navigation');

  if (!toggle || !menu) return () => {};

  const compactViewport = document.defaultView?.matchMedia?.('(max-width: 1023px)');
  const isCompactViewport = () => compactViewport?.matches ?? true;
  let menuOpen = false;

  const syncHiddenState = () => {
    menu.hidden = !menuOpen && isCompactViewport();
  };

  const setMenuOpen = (open: boolean, restoreFocus = false) => {
    menuOpen = open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Cerrar menú principal' : 'Abrir menú principal');
    toggle.classList.toggle('is-open', open);
    menu.classList.toggle('is-open', open);
    syncHiddenState();

    if (open) {
      menu.querySelector('a')?.focus();
    } else if (restoreFocus) {
      toggle.focus();
    }
  };

  const handleToggle = () => {
    if (isCompactViewport()) setMenuOpen(!menuOpen);
  };
  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !menuOpen) return;
    event.preventDefault();
    setMenuOpen(false, true);
  };
  const handleDocumentClick = (event: MouseEvent) => {
    const target = event.target as Node | null;
    if (menuOpen && target && !toggle.contains(target) && !menu.contains(target)) {
      setMenuOpen(false);
    }
  };
  const handleDocumentFocus = (event: FocusEvent) => {
    const target = event.target as Node | null;
    if (menuOpen && target && !toggle.contains(target) && !menu.contains(target)) {
      setMenuOpen(false);
    }
  };
  const handleViewportChange = () => {
    if (!isCompactViewport() && menuOpen) setMenuOpen(false);
    else syncHiddenState();
  };

  toggle.addEventListener('click', handleToggle);
  document.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleDocumentClick);
  document.addEventListener('focusin', handleDocumentFocus);
  compactViewport?.addEventListener('change', handleViewportChange);
  setMenuOpen(false);

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    toggle.removeEventListener('click', handleToggle);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('click', handleDocumentClick);
    document.removeEventListener('focusin', handleDocumentFocus);
    compactViewport?.removeEventListener('change', handleViewportChange);
    cleanups.delete(document);
  };

  cleanups.set(document, cleanup);
  return cleanup;
}
