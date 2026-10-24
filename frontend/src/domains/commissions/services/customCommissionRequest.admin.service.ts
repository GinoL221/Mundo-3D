import { API_URL, authFetch, readApiErrorMessage } from '../../../config';

export interface CustomCommissionRequestDTO {
  idCustomCommissionRequest: number;
  name: string;
  email: string;
  idea: string;
  idProduct: number | null;
  createdAt: string;
  expiresAt: string;
}

export class CustomCommissionRequestAdminApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'CustomCommissionRequestAdminApiError';
  }
}

export async function listCustomCommissionRequests(): Promise<CustomCommissionRequestDTO[]> {
  const response = await authFetch(`${API_URL}/api/custom-commission-requests`, { method: 'GET' });
  if (!response.ok) {
    let message = `Error ${response.status}`;
    try {
      message = readApiErrorMessage(await response.json(), message);
    } catch {
      // Keep a safe status-only message for non-JSON error responses.
    }
    throw new CustomCommissionRequestAdminApiError(response.status, message);
  }
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error('Unexpected response format');
  }
  if (!Array.isArray(data)) {
    throw new Error('Unexpected response format');
  }
  return data as CustomCommissionRequestDTO[];
}
