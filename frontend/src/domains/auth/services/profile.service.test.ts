import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProfile } from './profile.service';

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const user = {
  idUser: 42,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@example.test',
  image: null,
  idRole: 2,
  category: null,
};

describe('fetchProfile', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { cookie: '' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('loads the fixed self-profile endpoint with credentialed authFetch behavior', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, { user }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProfile()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/users\/me$/),
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('exposes a stable 401 status and safe API message for guests', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, { error: 'Token de autenticación no proporcionado' }))
      .mockResolvedValueOnce(response(401, { error: 'Sesión expirada' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchProfile()).rejects.toMatchObject({
      status: 401,
      message: 'Token de autenticación no proporcionado',
    });
  });

  it('rejects a malformed success envelope instead of fabricating profile data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(response(200, { user: { email: 'partial' } })),
    );

    await expect(fetchProfile()).rejects.toMatchObject({
      status: 500,
      message: 'La respuesta del perfil no es válida.',
    });
  });

  it('preserves a generic server status and fallback message for non-JSON failures', async () => {
    const brokenResponse = {
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    } as unknown as Response;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(brokenResponse));

    await expect(fetchProfile()).rejects.toMatchObject({
      status: 503,
      message: 'No pudimos cargar tu perfil.',
    });
  });
});
