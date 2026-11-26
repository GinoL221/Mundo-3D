import { API_URL, authFetch } from '../../../config';
import { createUserAdapter, type APIUser, type User } from '../adapters/auth.adapter';

export type FetchAdminUsersErrorCode = 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NETWORK' | 'UNKNOWN';

export type FetchAdminUsersResult =
  | { ok: true; count: number; users: User[] }
  | { ok: false; code: FetchAdminUsersErrorCode; message: string };

interface APIUsersIndexResponse {
  count?: number;
  users?: APIUser[];
}

export async function fetchAdminUsers(): Promise<FetchAdminUsersResult> {
  let res: Response;
  try {
    res = await authFetch(`${API_URL}/api/users`, { method: 'GET' });
  } catch {
    return {
      ok: false,
      code: 'NETWORK',
      message: 'No pudimos conectar con el servidor. Intentá de nuevo.',
    };
  }

  if (res.status === 401) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: 'Necesitás iniciar sesión como administrador para consultar usuarios.',
    };
  }

  if (res.status === 403) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: 'Solo una cuenta ADMIN puede consultar el listado de usuarios.',
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      code: 'UNKNOWN',
      message: 'No pudimos cargar el listado de usuarios. Intentá nuevamente.',
    };
  }

  let body: APIUsersIndexResponse;
  try {
    body = (await res.json()) as APIUsersIndexResponse;
  } catch {
    return {
      ok: false,
      code: 'UNKNOWN',
      message: 'Recibimos una respuesta inválida del servidor. Intentá nuevamente.',
    };
  }

  const rawUsers = Array.isArray(body?.users) ? body.users : [];
  const users = rawUsers.map(createUserAdapter);
  const count = typeof body?.count === 'number' ? body.count : users.length;
  return { ok: true, count, users };
}
