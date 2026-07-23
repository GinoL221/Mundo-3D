type Cleanup = () => void;
const cleanups = new WeakMap<Document, Cleanup>();

export function initializeThemeToggle(document: Document, storage: Storage): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;
  const icon = document.querySelector('.theme-toggle-btn__icon');
  const button = document.getElementById('theme-toggle');
  const apply = (value: string) => {
    const theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    if (icon) icon.textContent = theme === 'light' ? '☀️' : '🌙';
  };
  apply(storage.getItem('theme') || 'dark');
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
