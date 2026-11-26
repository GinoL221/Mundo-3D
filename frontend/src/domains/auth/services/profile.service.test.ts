import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentProfile } from './profile.service';
import { Role } from '../adapters/auth.adapter';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchCurrentProfile', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { cookie: 'm3d_csrf=random.hmac' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('requests GET /api/users/me with credentials and returns adapted User on 200', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        idUser: 3,
        firstName: 'Lucía',
        lastName: 'Taller',
        email: 'staff@email.com',
        image: null,
        idRole: Role.STAFF,
      }),
    );

    const result = await fetchCurrentProfile();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/users\/me$/);
    expect(options.method).toBe('GET');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({
      ok: true,
      user: {
        id: 3,
        firstName: 'Lucía',
        lastName: 'Taller',
        email: 'staff@email.com',
        image: '',
        idRole: Role.STAFF,
      },
    });
  });

  it('maps 401 (after refresh attempt fails) to UNAUTHENTICATED', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, { error: 'No autenticado' }))
      .mockResolvedValueOnce(jsonResponse(401, { error: 'Refresh inválido' }));

    const result = await fetchCurrentProfile();

    expect(result).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
      message: expect.any(String),
    });
  });

  it('maps network errors to NETWORK', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    const result = await fetchCurrentProfile();

    expect(result).toEqual({
      ok: false,
      code: 'NETWORK',
      message: expect.any(String),
    });
  });

  it('maps 404, 500, and malformed payloads to UNKNOWN', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { error: 'User not found' }));
    const notFound = await fetchCurrentProfile();
    expect(notFound.ok).toBe(false);
    if (!notFound.ok) expect(notFound.code).toBe('UNKNOWN');

    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    const serverErr = await fetchCurrentProfile();
    expect(serverErr.ok).toBe(false);
    if (!serverErr.ok) expect(serverErr.code).toBe('UNKNOWN');

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { invalid: true }));
    const malformed = await fetchCurrentProfile();
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.code).toBe('UNKNOWN');
  });
});
