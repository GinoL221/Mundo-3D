import {
  API_URL,
  apiFetch,
  authFetch,
  getSessionUser,
  isDemoSessionActive,
  isOperationalRole,
  readApiErrorMessage,
  withCredentials,
} from '../../../config';

export interface CustomCommissionRequestInput {
  name: string;
  email: string;
  phone?: string | null;
  idea: string;
  idProduct?: number;
}

export interface MyCommissionRequestDTO {
  idCustomCommissionRequest: number;
  name: string;
  email: string;
  phone: string | null;
  idea: string;
  idProduct: number | null;
  createdAt: string;
  expiresAt: string;
}

export type SubmitCustomCommissionRequestResult =
  | { ok: true }
  | { ok: false; reason: 'validation' | 'rate-limit' | 'server' | 'network' };

export type FetchMyCommissionRequestsResult =
  | { ok: true; requests: MyCommissionRequestDTO[] }
  | { ok: false; code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'ERROR'; message: string };

export async function submitCustomCommissionRequest(
  input: CustomCommissionRequestInput,
): Promise<SubmitCustomCommissionRequestResult> {
  const trimmedPhone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const payload: CustomCommissionRequestInput = {
    name: input.name,
    email: input.email,
    idea: input.idea,
    ...(trimmedPhone ? { phone: trimmedPhone } : {}),
    ...(input.idProduct === undefined ? {} : { idProduct: input.idProduct }),
  };

  const url = `${API_URL}/api/custom-commission-requests`;
  const baseInit: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };

  try {
    let response: Response;
    if (isDemoSessionActive()) {
      response = await apiFetch(url, baseInit);
    } else {
      const sessionUser = getSessionUser();
      const shouldSendBuyerCredentials = Boolean(sessionUser && !isOperationalRole(sessionUser));
      response = shouldSendBuyerCredentials
        ? await fetch(url, withCredentials(baseInit))
        : await apiFetch(url, baseInit);
    }
    if (response.ok) return { ok: true };
    if (response.status === 400) return { ok: false, reason: 'validation' };
    if (response.status === 429) return { ok: false, reason: 'rate-limit' };
    return { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

export async function listMyCustomCommissionRequests(): Promise<FetchMyCommissionRequestsResult> {
  try {
    const response = await authFetch(`${API_URL}/api/custom-commission-requests/mine`, {
      method: 'GET',
    });

    if (response.status === 401) {
      return {
        ok: false,
        code: 'UNAUTHENTICATED',
        message: 'Iniciá sesión para consultar tus solicitudes de encargo.',
      };
    }

    if (response.status === 403) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        message: 'Las cuentas operativas del taller consultan encargos desde el panel del taller.',
      };
    }

    if (!response.ok) {
      let message = 'No pudimos cargar tus solicitudes de encargo.';
      try {
        message = readApiErrorMessage(await response.json(), message);
      } catch {
        // Keep safe fallback message for non-JSON responses.
      }
      return { ok: false, code: 'ERROR', message };
    }

    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return {
        ok: false,
        code: 'ERROR',
        message: 'Recibimos una respuesta inesperada del servidor.',
      };
    }

    if (!Array.isArray(data)) {
      return {
        ok: false,
        code: 'ERROR',
        message: 'Recibimos una respuesta inesperada del servidor.',
      };
    }

    return { ok: true, requests: data as MyCommissionRequestDTO[] };
  } catch {
    return {
      ok: false,
      code: 'ERROR',
      message: 'No pudimos conectar con el servidor. Volvé a intentar en unos segundos.',
    };
  }
}
