import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service';

function buildAPIUser() {
  return {
    idUser: 1,
    firstName: 'Ada',
    lastName: 'Lovelace',
    email: 'ada@test.com',
    image: null,
  };
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

describe('AuthService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('login', () => {
    it('throws without calling fetch when email is missing', async () => {
      await expect(AuthService.login('', 'password123')).rejects.toThrow(
        'Por favor completá todos los campos.'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('throws without calling fetch when password is missing', async () => {
      await expect(AuthService.login('ada@test.com', '')).rejects.toThrow(
        'Por favor completá todos los campos.'
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('posts credentials and returns adapted auth data on success', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(200, { token: 'jwt-token', user: buildAPIUser() })
      );

      const result = await AuthService.login('ada@test.com', 'password123');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/users/login');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({ email: 'ada@test.com', password: 'password123' });

      expect(result).toEqual({
        token: 'jwt-token',
        user: { id: 1, firstName: 'Ada', lastName: 'Lovelace', email: 'ada@test.com', image: '' },
      });
    });

    it('throws the API "error" message when login fails', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Credenciales inválidas' }));

      await expect(AuthService.login('ada@test.com', 'wrong')).rejects.toThrow(
        'Credenciales inválidas'
      );
    });

    it('falls back to the API "message" field when "error" is absent', async () => {
      fetchMock.mockResolvedValue(jsonResponse(401, { message: 'No autorizado' }));

      await expect(AuthService.login('ada@test.com', 'wrong')).rejects.toThrow('No autorizado');
    });

    it('falls back to a default message when neither "error" nor "message" is present', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}));

      await expect(AuthService.login('ada@test.com', 'wrong')).rejects.toThrow(
        'Error al iniciar sesión.'
      );
    });
  });

  describe('register', () => {
    function buildFormData() {
      const formData = new FormData();
      formData.append('firstName', 'Ada');
      formData.append('email', 'ada@test.com');
      formData.append('password', 'password123');
      return formData;
    }

    it('posts the FormData as-is and returns adapted auth data on success', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(201, { token: 'jwt-token', user: buildAPIUser() })
      );
      const formData = buildFormData();

      const result = await AuthService.register(formData);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0];
      expect(url).toContain('/api/users/register');
      expect(options.method).toBe('POST');
      expect(options.body).toBe(formData);
      expect(result.user.email).toBe('ada@test.com');
    });

    it('extracts the first field error when "errors" is a field-keyed object', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, { errors: { email: { msg: 'El email ya está en uso' } } })
      );

      await expect(AuthService.register(buildFormData())).rejects.toThrow(
        'El email ya está en uso'
      );
    });

    it('falls back to the default message when the field-keyed "errors" object is empty', async () => {
      fetchMock.mockResolvedValue(jsonResponse(400, { errors: {} }));

      await expect(AuthService.register(buildFormData())).rejects.toThrow(
        'Error al registrarse.'
      );
    });

    it('extracts the first message when "errors" is an express-validator array', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(400, { errors: [{ msg: 'La contraseña es muy corta' }, { msg: 'otro error' }] })
      );

      await expect(AuthService.register(buildFormData())).rejects.toThrow(
        'La contraseña es muy corta'
      );
    });

    it('falls back to the default message when the "errors" array is empty', async () => {
      fetchMock.mockResolvedValue(jsonResponse(400, { errors: [] }));

      await expect(AuthService.register(buildFormData())).rejects.toThrow(
        'Error al registrarse.'
      );
    });

    it('uses the root "error" field when "errors" is absent', async () => {
      fetchMock.mockResolvedValue(jsonResponse(409, { error: 'El usuario ya existe' }));

      await expect(AuthService.register(buildFormData())).rejects.toThrow('El usuario ya existe');
    });

    it('falls back to the default message when no error information is present', async () => {
      fetchMock.mockResolvedValue(jsonResponse(500, {}));

      await expect(AuthService.register(buildFormData())).rejects.toThrow(
        'Error al registrarse.'
      );
    });
  });
});
