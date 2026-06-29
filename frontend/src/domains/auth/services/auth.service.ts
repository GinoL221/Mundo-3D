import { API_URL } from '../../../config';
import { createAuthAdapter } from '../adapters/auth.adapter';
import type { AuthData, APILoginResponse } from '../adapters/auth.adapter';

export class AuthService {
  static async login(email: string, password: string): Promise<AuthData> {
    if (!email || !password) {
      throw new Error('Por favor completá todos los campos.');
    }

    const res = await fetch(`${API_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg = data.error || data.message || 'Error al iniciar sesión.';
      throw new Error(errorMsg);
    }

    return createAuthAdapter(data as APILoginResponse);
  }

  static async register(formData: FormData): Promise<AuthData> {
    const res = await fetch(`${API_URL}/api/users/register`, {
      method: 'POST',
      body: formData,
    });

    const data = await res.json();

    if (!res.ok) {
      // Handle express-validator structures or root errors
      let errorMsg = 'Error al registrarse.';
      if (data.errors) {
        // If errors is an object mapped by field (e.g. { firstName: { msg: '...' } })
        if (typeof data.errors === 'object' && !Array.isArray(data.errors)) {
          const keys = Object.keys(data.errors);
          if (keys.length > 0) {
            errorMsg = (data.errors[keys[0]] as { msg?: string })?.msg || errorMsg;
          }
        } else if (Array.isArray(data.errors) && data.errors.length > 0) {
          errorMsg = data.errors[0]?.msg || errorMsg;
        }
      } else if (data.error) {
        errorMsg = data.error;
      }
      throw new Error(errorMsg);
    }

    return createAuthAdapter(data as APILoginResponse);
  }
}
