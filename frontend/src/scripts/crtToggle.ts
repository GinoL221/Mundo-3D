type Cleanup = () => void;
const cleanups = new WeakMap<Document, Cleanup>();

export function initializeCrtToggle(document: Document, storage: Storage): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;
  const icon = document.querySelector('.crt-toggle-btn__icon');
  const button = document.getElementById('crt-toggle');
  const apply = (value: string) => {
    const enabled = value === 'enabled';
    document.documentElement.classList.toggle('crt-theme-active', enabled);
    if (icon) icon.textContent = enabled ? '📺' : '🔌';
  };
  apply(storage.getItem('retro-theme-preference') || 'enabled');
  const toggle = () => {
    const next = document.documentElement.classList.contains('crt-theme-active')
      ? 'disabled'
      : 'enabled';
    storage.setItem('retro-theme-preference', next);
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
