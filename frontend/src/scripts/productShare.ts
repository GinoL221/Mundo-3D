interface SharePayload {
  productId: number | string;
  name: string;
  priceLabel: string;
}

interface ShareLinks {
  text: string;
  whatsappUrl: string;
  emailUrl: string;
}

interface ShareElementLike {
  hidden: boolean | string;
  textContent: string | null;
  focus(): void;
  contains(target: unknown): boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

interface ShareInputLike extends ShareElementLike {
  value: string;
  select(): void;
}

interface ShareLinkLike extends ShareElementLike {
  href: string;
}

export interface ShareElements {
  anchor: Pick<ShareElementLike, 'contains'> | null;
  triggerButton: ShareElementLike;
  panel: ShareElementLike;
  closeButton: ShareElementLike;
  summaryEl: Pick<ShareElementLike, 'textContent'> | null;
  urlInput: ShareInputLike;
  copyButton: ShareElementLike;
  whatsappLink: ShareLinkLike;
  emailLink: ShareLinkLike;
  nativeButton: ShareElementLike;
  statusEl: Pick<ShareElementLike, 'textContent'> | null;
}

interface ShareNavigatorLike {
  clipboard?: {
    writeText?: (text: string) => Promise<void>;
  };
  share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>;
}

export interface ShareDocumentLike {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
  execCommand?: (commandId: string) => boolean;
}

interface ShareEnvironment {
  origin?: string;
  navigator?: ShareNavigatorLike;
  document?: ShareDocumentLike;
  setTimeout?: (handler: () => void, delayMs: number) => ReturnType<typeof globalThis.setTimeout>;
  clearTimeout?: (timerId: ReturnType<typeof globalThis.setTimeout>) => void;
}

const DEFAULT_COPY_LABEL = 'Copiar';
const COPIED_LABEL = 'Copiado';
const COPY_RESET_MS = 2000;

export function buildCanonicalProductUrl(productId: number | string, origin: string): string {
  const normalizedOrigin = origin.replace(/\/+$/, '');
  return `${normalizedOrigin}/product?id=${encodeURIComponent(String(productId))}`;
}

export function buildShareLinks(input: {
  name: string;
  priceLabel: string;
  url: string;
}): ShareLinks {
  const text = `Mirá "${input.name}" (${input.priceLabel}) en Mundo 3D:`;
  return {
    text,
    whatsappUrl: `https://wa.me/?text=${encodeURIComponent(`${text} ${input.url}`)}`,
    emailUrl: `mailto:?subject=${encodeURIComponent(`${input.name} — Mundo 3D`)}&body=${encodeURIComponent(`${text}\n${input.url}`)}`,
  };
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

export function setupProductShare(
  elements: ShareElements,
  payload: SharePayload,
  env: ShareEnvironment = {},
): () => void {
  const origin = env.origin ?? globalThis.location?.origin ?? '';
  const nav: ShareNavigatorLike | undefined = env.navigator ?? globalThis.navigator;
  const doc: ShareDocumentLike | undefined = env.document ?? globalThis.document;
  const scheduleTimer =
    env.setTimeout ??
    ((handler: () => void, delayMs: number) => globalThis.setTimeout(handler, delayMs));
  const cancelTimer =
    env.clearTimeout ??
    ((timerId: ReturnType<typeof globalThis.setTimeout>) => globalThis.clearTimeout(timerId));

  let copyResetTimer: ReturnType<typeof globalThis.setTimeout> | undefined;

  const setStatus = (message: string): void => {
    if (elements.statusEl) {
      elements.statusEl.textContent = message;
    }
  };

  const resetCopyLabel = (): void => {
    if (copyResetTimer !== undefined) {
      cancelTimer(copyResetTimer);
      copyResetTimer = undefined;
    }
    elements.copyButton.textContent = DEFAULT_COPY_LABEL;
  };

  const syncPanelContent = (): { url: string; text: string } => {
    const url = buildCanonicalProductUrl(payload.productId, origin);
    const links = buildShareLinks({
      name: payload.name,
      priceLabel: payload.priceLabel,
      url,
    });

    elements.urlInput.value = url;
    if (elements.summaryEl) {
      elements.summaryEl.textContent = `${payload.name} · ${payload.priceLabel}`;
    }
    elements.whatsappLink.href = links.whatsappUrl;
    elements.emailLink.href = links.emailUrl;
    elements.nativeButton.hidden = typeof nav?.share !== 'function';

    return { url, text: links.text };
  };

  const openPanel = (): void => {
    syncPanelContent();
    resetCopyLabel();
    setStatus('');
    elements.panel.hidden = false;
    elements.triggerButton.setAttribute('aria-expanded', 'true');
    elements.copyButton.focus();
  };

  const closePanel = (restoreFocus: boolean): void => {
    if (elements.panel.hidden) return;
    elements.panel.hidden = true;
    elements.triggerButton.setAttribute('aria-expanded', 'false');
    resetCopyLabel();
    if (restoreFocus) {
      elements.triggerButton.focus();
    }
  };

  const onTriggerClick = (): void => {
    if (elements.panel.hidden) {
      openPanel();
    } else {
      closePanel(false);
    }
  };

  const onCloseClick = (): void => {
    closePanel(true);
  };

  const onCopyClick = async (): Promise<void> => {
    const { url } = syncPanelContent();
    resetCopyLabel();

    let copied = false;
    const writeText = nav?.clipboard?.writeText;
    if (typeof writeText === 'function') {
      try {
        await writeText.call(nav?.clipboard, url);
        copied = true;
      } catch {
        copied = false;
      }
    }

    if (!copied) {
      elements.urlInput.focus();
      elements.urlInput.select();
      if (typeof doc?.execCommand === 'function') {
        try {
          copied = Boolean(doc.execCommand('copy'));
        } catch {
          copied = false;
        }
      }
    }

    if (copied) {
      elements.copyButton.textContent = COPIED_LABEL;
      setStatus('Enlace copiado al portapapeles.');
      copyResetTimer = scheduleTimer(() => {
        copyResetTimer = undefined;
        elements.copyButton.textContent = DEFAULT_COPY_LABEL;
      }, COPY_RESET_MS);
    } else {
      elements.copyButton.textContent = DEFAULT_COPY_LABEL;
      setStatus('No pudimos copiar automáticamente. Copiá el enlace seleccionado arriba.');
    }
  };

  const onNativeShareClick = async (): Promise<void> => {
    const shareFn = nav?.share;
    if (typeof shareFn !== 'function') return;

    const { url, text } = syncPanelContent();
    try {
      await shareFn.call(nav, {
        title: payload.name,
        text,
        url,
      });
      setStatus('Enlace compartido.');
    } catch (error) {
      if (isAbortError(error)) return;
      setStatus('No pudimos abrir el menú del sistema. Podés copiar el enlace arriba.');
    }
  };

  const onDocumentKeydown = (event: Event): void => {
    if (elements.panel.hidden) return;
    const keyEvent = event as KeyboardEvent;
    if (keyEvent.key !== 'Escape') return;
    keyEvent.preventDefault();
    closePanel(true);
  };

  const onDocumentClick = (event: Event): void => {
    if (elements.panel.hidden) return;
    const target = event.target;
    const insideAnchor = elements.anchor
      ? target != null && elements.anchor.contains(target)
      : (target != null && elements.panel.contains(target)) ||
        (target != null && elements.triggerButton.contains(target));

    if (!insideAnchor) {
      closePanel(false);
    }
  };

  syncPanelContent();
  elements.panel.hidden = true;
  elements.triggerButton.setAttribute('aria-expanded', 'false');
  elements.copyButton.textContent = DEFAULT_COPY_LABEL;

  const handleCopyClick = (): void => {
    void onCopyClick();
  };
  const handleNativeClick = (): void => {
    void onNativeShareClick();
  };

  elements.triggerButton.addEventListener('click', onTriggerClick);
  elements.closeButton.addEventListener('click', onCloseClick);
  elements.copyButton.addEventListener('click', handleCopyClick);
  elements.nativeButton.addEventListener('click', handleNativeClick);
  doc?.addEventListener('keydown', onDocumentKeydown);
  doc?.addEventListener('click', onDocumentClick);

  return () => {
    resetCopyLabel();
    elements.triggerButton.removeEventListener('click', onTriggerClick);
    elements.closeButton.removeEventListener('click', onCloseClick);
    elements.copyButton.removeEventListener('click', handleCopyClick);
    elements.nativeButton.removeEventListener('click', handleNativeClick);
    doc?.removeEventListener('keydown', onDocumentKeydown);
    doc?.removeEventListener('click', onDocumentClick);
  };
}
