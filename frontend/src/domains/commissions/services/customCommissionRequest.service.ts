import { API_URL } from '../../../config';

export interface CustomCommissionRequestInput {
  name: string;
  email: string;
  idea: string;
  idProduct?: number;
}

export type SubmitCustomCommissionRequestResult =
  | { ok: true }
  | { ok: false; reason: 'validation' | 'rate-limit' | 'server' | 'network' };

export async function submitCustomCommissionRequest(
  input: CustomCommissionRequestInput,
): Promise<SubmitCustomCommissionRequestResult> {
  const payload: CustomCommissionRequestInput = {
    name: input.name,
    email: input.email,
    idea: input.idea,
    ...(input.idProduct === undefined ? {} : { idProduct: input.idProduct }),
  };

  try {
    const response = await fetch(`${API_URL}/api/custom-commission-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (response.ok) return { ok: true };
    if (response.status === 400) return { ok: false, reason: 'validation' };
    if (response.status === 429) return { ok: false, reason: 'rate-limit' };
    return { ok: false, reason: 'server' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}
