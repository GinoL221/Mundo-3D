type Cleanup = () => void;

interface TocEntry {
  id: string;
  link: HTMLAnchorElement;
  target: HTMLElement;
}

const cleanups = new WeakMap<Document, Cleanup>();

function supportsNativeScrollTargetGroup(): boolean {
  return (
    typeof CSS !== 'undefined' &&
    typeof CSS.supports === 'function' &&
    CSS.supports('scroll-target-group: auto')
  );
}

export function initializeEditorialSidebar(rootDocument: Document = document): Cleanup {
  const existing = cleanups.get(rootDocument);
  if (existing) return existing;

  const aside = rootDocument.querySelector<HTMLElement>('[data-editorial-sidebar]');
  if (!aside) return () => {};

  const toggle = aside.querySelector<HTMLButtonElement>('.editorial-sidebar__toggle');
  const tocLinks = Array.from(
    aside.querySelectorAll<HTMLAnchorElement>('[data-editorial-toc] a[href^="#"]'),
  );
  const view = rootDocument.defaultView;
  const compactViewport = view?.matchMedia?.('(max-width: 1023px)') ?? null;

  let isOpen = aside.getAttribute('data-open') === 'true';

  const setOpen = (open: boolean, restoreFocus = false) => {
    isOpen = open;
    if (open) {
      aside.setAttribute('data-open', 'true');
    } else {
      aside.removeAttribute('data-open');
    }
    toggle?.setAttribute('aria-expanded', String(open));
    if (!open && restoreFocus) {
      toggle?.focus();
    }
  };

  const handleToggleClick = () => {
    setOpen(!isOpen);
  };

  const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !isOpen) return;
    event.preventDefault();
    setOpen(false, true);
  };

  const handleViewportChange = (event: MediaQueryListEvent) => {
    if (!event.matches && isOpen) {
      setOpen(false);
    }
  };

  const handleOutsideClick = (event: MouseEvent) => {
    if (!isOpen) return;
    const target = event.target as Node | null;
    if (target && !aside.contains(target)) {
      setOpen(false);
    }
  };

  toggle?.addEventListener('click', handleToggleClick);
  rootDocument.addEventListener('keydown', handleKeydown);
  rootDocument.addEventListener('click', handleOutsideClick);
  compactViewport?.addEventListener('change', handleViewportChange);

  const tocCleanups: Cleanup[] = [];

  if (tocLinks.length > 0) {
    if (supportsNativeScrollTargetGroup()) {
      const syncFromTargetCurrent = () => {
        let activeLink: HTMLAnchorElement | null = null;
        for (const link of tocLinks) {
          try {
            if (link.matches(':target-current')) {
              activeLink = link;
              break;
            }
          } catch {
            // Selector evaluation can throw in non-supporting environments.
          }
        }
        for (const link of tocLinks) {
          if (link === activeLink) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        }
      };

      const handleScrollEnd = () => {
        syncFromTargetCurrent();
      };

      let pendingFrame: number | null = null;
      const scheduleSync = () => {
        if (!view || typeof view.requestAnimationFrame !== 'function') {
          syncFromTargetCurrent();
          return;
        }
        if (pendingFrame !== null) return;
        pendingFrame = view.requestAnimationFrame(() => {
          pendingFrame = null;
          syncFromTargetCurrent();
        });
      };

      const handleTocClick = () => {
        setOpen(false);
        syncFromTargetCurrent();
        scheduleSync();
      };

      syncFromTargetCurrent();
      rootDocument.addEventListener('scroll', scheduleSync, { passive: true });
      rootDocument.addEventListener('scrollend', handleScrollEnd);
      view?.addEventListener('scrollend', handleScrollEnd);
      view?.addEventListener('hashchange', handleScrollEnd);
      for (const link of tocLinks) {
        link.addEventListener('click', handleTocClick);
      }

      tocCleanups.push(() => {
        rootDocument.removeEventListener('scroll', scheduleSync);
        rootDocument.removeEventListener('scrollend', handleScrollEnd);
        view?.removeEventListener('scrollend', handleScrollEnd);
        view?.removeEventListener('hashchange', handleScrollEnd);
        if (pendingFrame !== null && view && typeof view.cancelAnimationFrame === 'function') {
          view.cancelAnimationFrame(pendingFrame);
        }
        for (const link of tocLinks) {
          link.removeEventListener('click', handleTocClick);
        }
      });
    } else {
      const entries: TocEntry[] = tocLinks
        .map((link) => {
          const href = link.getAttribute('href') ?? '';
          const id = href.startsWith('#') ? href.slice(1) : '';
          const target = id ? rootDocument.getElementById(id) : null;
          return id && target ? { id, link, target } : null;
        })
        .filter((entry): entry is TocEntry => entry !== null);

      const intersectingIds = new Set<string>();

      const applyActiveEntry = (activeId: string | null) => {
        for (const entry of entries) {
          const isCurrent = entry.id === activeId;
          entry.link.classList.toggle('is-target-current', isCurrent);
          if (isCurrent) {
            entry.link.setAttribute('aria-current', 'location');
          } else {
            entry.link.removeAttribute('aria-current');
          }
        }
      };

      const resolveActiveId = (): string | null => {
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          const entry = entries[i];
          if (entry && intersectingIds.has(entry.id)) {
            return entry.id;
          }
        }
        return entries[0]?.id ?? null;
      };

      let observer: IntersectionObserver | null = null;
      if (typeof IntersectionObserver === 'function' && entries.length > 0) {
        observer = new IntersectionObserver(
          (observerEntries) => {
            for (const observerEntry of observerEntries) {
              const id = observerEntry.target.id;
              if (!id) continue;
              if (observerEntry.isIntersecting) {
                intersectingIds.add(id);
              } else {
                intersectingIds.delete(id);
              }
            }
            applyActiveEntry(resolveActiveId());
          },
          {
            rootMargin: '0px 0px -35% 0px',
            threshold: 0,
          },
        );

        for (const entry of entries) {
          observer.observe(entry.target);
        }
      }

      if (entries[0]) {
        applyActiveEntry(entries[0].id);
      }

      const clickHandlers = new Map<HTMLAnchorElement, () => void>();
      for (const entry of entries) {
        const handler = () => {
          setOpen(false);
          applyActiveEntry(entry.id);
        };
        clickHandlers.set(entry.link, handler);
        entry.link.addEventListener('click', handler);
      }

      tocCleanups.push(() => {
        observer?.disconnect();
        for (const [link, handler] of clickHandlers) {
          link.removeEventListener('click', handler);
        }
      });
    }
  }

  let active = true;
  const cleanup = () => {
    if (!active) return;
    active = false;
    toggle?.removeEventListener('click', handleToggleClick);
    rootDocument.removeEventListener('keydown', handleKeydown);
    rootDocument.removeEventListener('click', handleOutsideClick);
    compactViewport?.removeEventListener('change', handleViewportChange);
    for (const fn of tocCleanups) fn();
    cleanups.delete(rootDocument);
  };

  cleanups.set(rootDocument, cleanup);
  return cleanup;
}

if (typeof document !== 'undefined') {
  initializeEditorialSidebar(document);
}
