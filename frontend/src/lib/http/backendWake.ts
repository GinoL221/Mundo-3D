export const BACKEND_SLEEPING_CODE = 'BACKEND_SLEEPING';

export interface BackendSleepingInfo {
  wakeUrl: string | null;
}

/**
 * Validates that an external wake URL is an explicit http(s) URL with a
 * non-opaque origin before assigning it to an anchor `href`. Uses `new URL()`
 * rather than string-prefix checks so `javascript:`, `data:`, and malformed
 * inputs are rejected fail-closed.
 */
export function sanitizeExternalHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.origin === 'null') return null;
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.href;
  } catch {
    return null;
  }
}

/**
 * Inspects a failed API response for the Cloudflare Pages proxy's structured
 * `503 BACKEND_SLEEPING` payload. Returns `null` for any other status or
 * non-matching/malformed body without throwing.
 */
export async function readBackendSleepingInfo(
  response: Pick<Response, 'status' | 'json'> & { clone?: () => Pick<Response, 'json'> },
): Promise<BackendSleepingInfo | null> {
  if (response.status !== 503) {
    return null;
  }

  try {
    const reader = typeof response.clone === 'function' ? response.clone() : response;
    const body: unknown = await reader.json();
    if (!body || typeof body !== 'object') {
      return null;
    }
    const payload = body as { code?: unknown; wakeUrl?: unknown };
    if (payload.code !== BACKEND_SLEEPING_CODE) {
      return null;
    }
    return {
      wakeUrl: sanitizeExternalHttpUrl(payload.wakeUrl),
    };
  } catch {
    return null;
  }
}
