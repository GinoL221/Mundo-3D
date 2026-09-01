import { API_URL, readApiErrorMessage } from '../../../config';
import { createAuthAdapter } from '../adapters/auth.adapter';
import type { AuthData, APILoginResponse } from '../adapters/auth.adapter';

export class AuthService {
  static async login(email: string, password: string, remember = false): Promise<AuthData> {
    if (!email || !password) {
      throw new Error('Por favor completá todos los campos.');
    }

    const res = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, remember }),
    });

    const data: unknown = await res.json();

    if (!res.ok) {
      throw new Error(readApiErrorMessage(data, 'Error al iniciar sesión.'));
    }

    return createAuthAdapter(data as APILoginResponse);
  }

  static async register(formData: FormData): Promise<AuthData> {
    const res = await fetch(`${API_URL}/api/users/register`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const data: unknown = await res.json();

    if (!res.ok) {
      throw new Error(readApiErrorMessage(data, 'Error al registrarse.'));
    }

    return createAuthAdapter(data as APILoginResponse);
  }
}
