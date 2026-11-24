// Moved verbatim from `config.ts` (design.md D6, task 3.3). These functions
// are genuinely cross-domain (consumed by `cart`, `products`, and `auth`),
// so they live here rather than under `domains/auth/` — the architecture
// boundary check (`backend/tools/architecture/check.js`,
// `frontend.domain.locality` rule) only allows a `frontend/src/domains/<X>/`
// file to import from its own domain or from `config.ts`. `config.ts`
// re-exports these so `session.service.ts`/`auth.service.ts` and every
// other existing import specifier keep working unchanged.

import { demoRoleToId, getDemoSession } from './demoSessionState';

const CSRF_COOKIE_NAME = 'm3d_csrf';
const USER_COOKIE_NAME = 'm3d_user';

function readCookie(name: string): string | null {
  const entry = document.cookie.split('; ').find((piece) => piece.startsWith(`${name}=`));
  if (!entry) return null;
  return entry.slice(name.length + 1) || null;
}

/**
 * Reads the non-httpOnly `m3d_csrf` cookie set by the backend on
 * login/register. The value is an opaque signed string
 * (`<random>.<hmac>` — see backend's csrfToken.ts) and must be read
 * verbatim, no parsing needed. Returns null when absent (guest, or before
 * the first login).
 */
export function readCsrfToken(): string | null {
  return readCookie(CSRF_COOKIE_NAME);
}

/**
 * The `domain=` suffixes a cookie clear has to cover. The backend adds a
 * Domain attribute only when COOKIE_DOMAIN is set — empty in dev/CI, the
 * root domain in production — and a clear whose domain does not match the
 * set simply creates a second cookie instead of expiring the first. The
 * frontend is not told which topology it is in, so it sweeps the host-only
 * scope plus every parent domain. The last label is never swept on its own:
 * browsers reject `domain=com` outright, and attempting it would be noise.
 */
function expiryScopes(): string[] {
  // The host-only scope is unconditional: it is the one that matters in the
  // dev/CI topology, and losing it because a hostname could not be read
  // would silently turn the whole clear into a no-op.
  const scopes = [''];
  const hostname = typeof location === 'undefined' ? '' : (location?.hostname ?? '');
  const labels = hostname.split('.').filter(Boolean);
  for (let i = 0; i < labels.length - 1; i += 1) {
    scopes.push(`; domain=${labels.slice(i).join('.')}`);
  }
  return scopes;
}

/**
 * Expires the two session cookies the browser can actually read. The backend
 * clears all four on logout, but that only reaches the browser if the logout
 * RESPONSE is processed — and the tab that triggered logout navigates away
 * immediately, so it usually is not. Clearing the readable pair here makes
 * the UI-gating state correct the moment logout is clicked, independently of
 * the network; the httpOnly `m3d_auth`/`m3d_refresh` pair stays server-owned
 * and is cleared by the keepalive request's response.
 *
 * `path=/` must match what `cookieOptions()` set them with, or the write
 * creates a second cookie instead of expiring the existing one.
 */
export function expireClientReadableSessionCookies(): void {
  try {
    for (const name of [USER_COOKIE_NAME, CSRF_COOKIE_NAME]) {
      for (const scope of expiryScopes()) {
        document.cookie = `${name}=; Max-Age=0; path=/${scope}`;
      }
    }
  } catch {
    // Cookie access can be unavailable (a sandboxed frame, a non-DOM
    // caller). Swallowed for the same reason broadcastSessionChanged()
    // swallows an unsupported BroadcastChannel: this is UI cleanup, and it
    // must never stop clearSession() from reaching the server — that
    // request is what actually revokes the refresh family.
  }
}

/**
 * Merges credentialed-request settings into a fetch `RequestInit`: always
 * sends the browser's cookies (`credentials: 'include'`) and, when a CSRF
 * cookie is present, attaches it as `X-CSRF-Token` so the backend's
 * `csrfGuard` accepts the request (design.md "Decision: CSRF = signed
 * double-submit cookie"). Generic/reusable — every state-changing request
 * against the API needs this (consumed by CartService/product.admin.service).
 */
export function withCredentials(init: RequestInit = {}): RequestInit {
  const token = readCsrfToken();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };

  if (token) {
    headers['X-CSRF-Token'] = token;
  }

  return {
    ...init,
    credentials: 'include',
    headers,
  };
}

/**
 * The error envelope the API returns on any non-2xx response. `errors`
 * carries express-validator's two shapes: a field-keyed map, or an array of
 * field errors. Lives here rather than in a domain because both `auth` and
 * `products` read it, and the architecture boundary check
 * (`frontend.domain.locality`) only lets a domain import from its own
 * folder or from `config.ts`.
 */
export interface APIFieldError {
  msg?: string;
  path?: string;
  param?: string;
}

export interface APIErrorBody {
  error?: string;
  message?: string;
  errors?: Record<string, APIFieldError> | APIFieldError[];
}

export interface ParsedApiError {
  message: string;
  fieldErrors: Record<string, string>;
}

/**
 * Rich Error subclass thrown by `parseApiResponse` when the API returns a
 * non-2xx JSON payload. Preserves `Error.message` for all existing callers
 * while attaching parsed per-field validation messages (`fieldErrors`) and
 * HTTP `status` for forms that render field-level feedback.
 */
export class ApiError extends Error {
  readonly fieldErrors: Record<string, string>;
  readonly status?: number;

  constructor(message: string, fieldErrors: Record<string, string> = {}, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.fieldErrors = fieldErrors;
    this.status = status;
  }
}

function readFieldName(entry: APIFieldError | undefined, fallbackKey = ''): string {
  if (typeof entry?.path === 'string' && entry.path.trim()) {
    return entry.path.trim();
  }
  if (typeof entry?.param === 'string' && entry.param.trim()) {
    return entry.param.trim();
  }
  return fallbackKey.trim();
}

/**
 * Extracts both a summary message and a field-to-message map from an API
 * error body, supporting express-validator's array shape (`path` or legacy
 * `param` + `msg`) and field-keyed object shape (`{ [field]: { msg } }`).
 * Keeps the first message per field when multiple errors target the same
 * field. Never throws — malformed or absent bodies yield `{ message: fallback,
 * fieldErrors: {} }`.
 */
export function readApiErrorDetails(body: unknown, fallback: string): ParsedApiError {
  if (typeof body !== 'object' || body === null) {
    return { message: fallback, fieldErrors: {} };
  }

  const { errors, error, message } = body as APIErrorBody;
  const fieldErrorMap = new Map<string, string>();
  let firstMsg: string | undefined;

  if (Array.isArray(errors)) {
    for (const item of errors) {
      const msg = typeof item?.msg === 'string' ? item.msg.trim() : '';
      if (!msg) continue;
      if (!firstMsg) firstMsg = msg;
      const field = readFieldName(item);
      if (field && !fieldErrorMap.has(field)) {
        fieldErrorMap.set(field, msg);
      }
    }
  } else if (typeof errors === 'object' && errors !== null) {
    for (const [key, item] of Object.entries(errors)) {
      const msg = typeof item?.msg === 'string' ? item.msg.trim() : '';
      if (!msg) continue;
      if (!firstMsg) firstMsg = msg;
      const field = readFieldName(item, key);
      if (field && !fieldErrorMap.has(field)) {
        fieldErrorMap.set(field, msg);
      }
    }
  }

  const rootError = typeof error === 'string' && error.trim() ? error.trim() : undefined;
  const rootMessage = typeof message === 'string' && message.trim() ? message.trim() : undefined;

  return {
    message: firstMsg || rootError || rootMessage || fallback,
    fieldErrors: Object.fromEntries(fieldErrorMap),
  };
}

/**
 * Extracts a human-readable message from an API error body, preferring the
 * most specific source available: the first express-validator field error,
 * then a root `error`/`message`, then the caller's fallback. Never throws —
 * a malformed or absent body yields the fallback.
 */
export function readApiErrorMessage(body: unknown, fallback: string): string {
  return readApiErrorDetails(body, fallback).message;
}

const COLD_START_STATUSES = new Set([502, 503, 504]);
const COLD_START_ERROR_MESSAGE =
  'El servidor se está iniciando. Esperá unos segundos y volvé a intentarlo.';

type ParsedJsonResult = { ok: true; value: unknown } | { ok: false };

function tryParseJson(rawText: string): ParsedJsonResult {
  if (!rawText.trim()) {
    return { ok: false };
  }
  try {
    const value: unknown = JSON.parse(rawText);
    return { ok: true, value };
  } catch {
    return { ok: false };
  }
}

/**
 * Safely reads and parses an API `Response` without letting raw HTML/text
 * responses (such as Render Free cold-start 502/503/504 pages) trigger an
 * unhandled `SyntaxError` from `response.json()`.
 */
export async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  const rawText = await response.text();
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const parsed: ParsedJsonResult = contentType.includes('text/html')
    ? { ok: false }
    : tryParseJson(rawText);

  if (!response.ok) {
    if (parsed.ok) {
      const { message, fieldErrors } = readApiErrorDetails(parsed.value, fallbackMessage);
      throw new ApiError(message, fieldErrors, response.status);
    }
    if (COLD_START_STATUSES.has(response.status)) {
      throw new Error(COLD_START_ERROR_MESSAGE);
    }
    throw new Error(fallbackMessage);
  }

  if (parsed.ok) {
    return parsed.value as T;
  }

  throw new Error(fallbackMessage);
}

/**
 * Minimal shape read from the non-httpOnly `m3d_user` display cookie.
 * Centralized here so admin pages/components share one source of truth
 * for session reads and role checks instead of each redefining it.
 */
export interface SessionUser {
  idRole: number;
  isDemo?: boolean;
}

/**
 * Reads the active session user. When a Demo Sandbox session is active,
 * returns the synthetic demo user (`Role.USER` or `Role.STAFF`, never
 * `ADMIN`) without touching the standard `m3d_user` cookie; otherwise reads
 * `m3d_user` (design.md "Decision: Display data in a non-httpOnly m3d_user
 * cookie"). Never throws.
 */
export function getSessionUser(): SessionUser | null {
  const demo = getDemoSession();
  if (demo) {
    return { idRole: demoRoleToId(demo.role), isDemo: true };
  }
  try {
    const raw = readCookie(USER_COOKIE_NAME);
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw)) as SessionUser;
  } catch {
    return null;
  }
}
