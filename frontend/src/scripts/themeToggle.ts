type Cleanup = () => void;
const cleanups = new WeakMap<Document, Cleanup>();

export function initializeThemeToggle(document: Document, storage: Storage): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;
  const button = document.getElementById('theme-toggle');
  const apply = (value: string) => {
    const theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    button?.setAttribute(
      'aria-label',
      theme === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro',
    );
  };
  apply(storage.getItem('theme') || 'light');
  const toggle = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    storage.setItem('theme', next);
    apply(next);
  };
  button?.addEventListener('click', toggle);
  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    button?.removeEventListener('click', toggle);
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
