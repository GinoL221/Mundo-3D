import { API_URL, parseApiResponse } from '../../../config';
import { extractApiFieldErrors } from '../validation/authValidation';

const FALLBACK_RESEND_EMAIL_ERROR = 'Ingresá un correo válido';

export type ConfirmEmailOutcome = 'confirmed' | 'invalid' | 'rate-limited';

export type ResendEmailOutcome =
  | { status: 'accepted' }
  | { status: 'rate-limited' }
  | { status: 'validation-error'; fieldErrors: Record<string, string>; message: string };

export class ConfirmationNetworkError extends Error {
  constructor() {
    super('No se pudo conectar con el servidor.');
    this.name = 'ConfirmationNetworkError';
  }
}

export class EmailConfirmationService {
  static async confirmFromCurrentLocation(): Promise<ConfirmEmailOutcome> {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    const response = await this.post('/api/users/email-confirmation/confirm', { token });

    if (response.status === 204) return 'confirmed';
    if (response.status === 429) return 'rate-limited';
    return 'invalid';
  }

  static async resend(email: string): Promise<ResendEmailOutcome> {
    const response = await this.post('/api/users/email-confirmation/resend', { email });

    if (response.status === 429) {
      return { status: 'rate-limited' };
    }

    if (response.status === 400) {
      let fieldErrors: Record<string, string> = {};
      let message = FALLBACK_RESEND_EMAIL_ERROR;
      try {
        await parseApiResponse(response, FALLBACK_RESEND_EMAIL_ERROR);
      } catch (err) {
        fieldErrors = extractApiFieldErrors(err);
        message =
          fieldErrors.email ||
          (err instanceof Error && err.message.trim()
            ? err.message.trim()
            : FALLBACK_RESEND_EMAIL_ERROR);
      }

      return {
        status: 'validation-error',
        fieldErrors: fieldErrors.email ? fieldErrors : { email: message },
        message,
      };
    }

    if (response.ok) {
      return { status: 'accepted' };
    }

    throw new ConfirmationNetworkError();
  }

  private static async post(path: string, body: Record<string, string>): Promise<Response> {
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.status >= 500) throw new ConfirmationNetworkError();
      return response;
    } catch (error) {
      if (error instanceof ConfirmationNetworkError) throw error;
      throw new ConfirmationNetworkError();
    }
  }
}
