import { API_URL, authFetch } from '../../../config';
import { createUserAdapter, type APIUser, type User } from '../adapters/auth.adapter';

export type ProfileResult =
  | { ok: true; user: User }
  | { ok: false; code: 'UNAUTHENTICATED' | 'NETWORK' | 'UNKNOWN'; message: string };

function isAPIUser(value: unknown): value is APIUser {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.idUser === 'number' &&
    typeof record.firstName === 'string' &&
    typeof record.lastName === 'string' &&
    typeof record.email === 'string' &&
    typeof record.idRole === 'number'
  );
}

export async function fetchCurrentProfile(): Promise<ProfileResult> {
  try {
    const res = await authFetch(`${API_URL}/api/users/me`, { method: 'GET' });

    if (res.status === 401) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Iniciá sesión para ver los datos de tu cuenta.',
      };
    }

    if (res.status === 404) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'No encontramos los datos de tu cuenta.',
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'No pudimos cargar tu perfil. Intentá nuevamente en unos segundos.',
      };
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'Recibimos una respuesta inválida del servidor. Intentá nuevamente.',
      };
    }

    if (!isAPIUser(body)) {
      return {
        ok: false,
        code: 'UNKNOWN',
        message: 'No pudimos interpretar los datos de tu perfil. Intentá nuevamente.',
      };
    }

    return { ok: true, user: createUserAdapter(body) };
  } catch {
    return {
      ok: false,
      code: 'NETWORK',
      message: 'No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.',
    };
  }
}
