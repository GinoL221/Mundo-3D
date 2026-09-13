import { API_URL } from '../../../config';

export class ConfirmationNetworkError extends Error {
  constructor() {
    super('No se pudo conectar con el servidor.');
    this.name = 'ConfirmationNetworkError';
  }
}

export class EmailConfirmationService {
  static async confirmFromCurrentLocation(): Promise<'confirmed' | 'invalid'> {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    const response = await this.post('/api/users/email-confirmation/confirm', { token });

    if (response.status === 204) return 'confirmed';
    return 'invalid';
  }

  static async resend(email: string): Promise<'accepted'> {
    await this.post('/api/users/email-confirmation/resend', { email });
    return 'accepted';
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
