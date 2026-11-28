type Cleanup = () => void;
type ThemePreference = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const cleanups = new WeakMap<Document, Cleanup>();

const NEXT_PREFERENCE = {
  light: 'dark',
  dark: 'system',
  system: 'light',
} as const satisfies Record<ThemePreference, ThemePreference>;

// Mirrors Layout.astro's pre-paint inline script (normalizePreference,
// resolveTheme, and meta[name="color-scheme"]) so the initial paint matches
// hydrated state without FOUC.
function normalizePreference(value: string | null): ThemePreference {
  return value === 'dark' || value === 'system' || value === 'light' ? value : 'system';
}

function readThemePreference(storage: Storage): string | null {
  try {
    return storage.getItem('theme');
  } catch {
    return null;
  }
}

function writeThemePreference(storage: Storage, value: ThemePreference): void {
  try {
    storage.setItem('theme', value);
  } catch {
    // Storage may be blocked or full; keep the preference active in memory.
  }
}

function formatAriaLabel(preference: ThemePreference, resolved: ResolvedTheme): string {
  if (preference === 'light') return 'Tema: claro. Cambiar a tema oscuro';
  if (preference === 'dark') return 'Tema: oscuro. Cambiar a tema del sistema';
  const resolvedText = resolved === 'dark' ? 'oscuro' : 'claro';
  return `Tema: sistema (actualmente ${resolvedText}). Cambiar a tema claro`;
}

function formatTitle(preference: ThemePreference, resolved: ResolvedTheme): string {
  if (preference === 'light') return 'Tema: claro';
  if (preference === 'dark') return 'Tema: oscuro';
  const resolvedText = resolved === 'dark' ? 'oscuro' : 'claro';
  return `Tema: sistema (${resolvedText})`;
}

export function initializeThemeToggle(document: Document, storage: Storage): Cleanup {
  const existing = cleanups.get(document);
  if (existing) return existing;

  const button = document.getElementById('theme-toggle');
  const mediaQuery =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

  const resolveTheme = (preference: ThemePreference, matchesOverride?: boolean): ResolvedTheme => {
    if (preference !== 'system') return preference;
    const isDark = matchesOverride ?? mediaQuery?.matches ?? false;
    return isDark ? 'dark' : 'light';
  };

  let currentPreference = normalizePreference(readThemePreference(storage));

  const apply = (preference: ThemePreference, matchesOverride?: boolean) => {
    currentPreference = preference;
    const resolved = resolveTheme(preference, matchesOverride);
    const root = document.documentElement;
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-preference', preference);

    const colorSchemeMeta = document.querySelector?.('meta[name="color-scheme"]');
    colorSchemeMeta?.setAttribute('content', preference === 'system' ? 'light dark' : resolved);

    button?.setAttribute('aria-label', formatAriaLabel(preference, resolved));
    button?.setAttribute('title', formatTitle(preference, resolved));
  };

  apply(currentPreference);

  const toggle = () => {
    const next = NEXT_PREFERENCE[currentPreference];
    writeThemePreference(storage, next);
    apply(next);
  };

  const onMediaChange = (event: MediaQueryListEvent) => {
    if (currentPreference === 'system') {
      apply('system', typeof event?.matches === 'boolean' ? event.matches : undefined);
    }
  };

  button?.addEventListener('click', toggle);
  mediaQuery?.addEventListener?.('change', onMediaChange);

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    button?.removeEventListener('click', toggle);
    mediaQuery?.removeEventListener?.('change', onMediaChange);
    cleanups.delete(document);
  };
  cleanups.set(document, cleanup);
  return cleanup;
}
