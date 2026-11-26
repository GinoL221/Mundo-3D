import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '../adapters/auth.adapter';
import { fetchAdminUsers } from './user.admin.service';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('fetchAdminUsers', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('document', { cookie: 'm3d_csrf=tok.hmac' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('fetches GET /api/users with credentials and adapts UserDTO list', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        count: 2,
        users: [
          {
            idUser: 1,
            firstName: 'Demo',
            lastName: 'Buyer',
            email: 'buyer@demo.invalid',
            image: null,
            idRole: Role.USER,
          },
          {
            idUser: 2,
            firstName: 'Demo',
            lastName: 'Staff',
            email: 'staff@demo.invalid',
            image: null,
            idRole: Role.STAFF,
          },
        ],
      }),
    );

    const result = await fetchAdminUsers();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/users$/);
    expect(options.method).toBe('GET');
    expect(options.credentials).toBe('include');
    expect(result).toEqual({
      ok: true,
      count: 2,
      users: [
        {
          id: 1,
          firstName: 'Demo',
          lastName: 'Buyer',
          email: 'buyer@demo.invalid',
          image: '',
          idRole: Role.USER,
        },
        {
          id: 2,
          firstName: 'Demo',
          lastName: 'Staff',
          email: 'staff@demo.invalid',
          image: '',
          idRole: Role.STAFF,
        },
      ],
    });
  });

  it('maps 403, 401, network error, and 500 cleanly', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(403, {}));
    expect(await fetchAdminUsers()).toEqual({
      ok: false,
      code: 'FORBIDDEN',
      message: expect.any(String),
    });

    fetchMock
      .mockResolvedValueOnce(jsonResponse(401, {}))
      .mockResolvedValueOnce(jsonResponse(401, {}));
    expect(await fetchAdminUsers()).toEqual({
      ok: false,
      code: 'UNAUTHENTICATED',
      message: expect.any(String),
    });

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await fetchAdminUsers()).toEqual({
      ok: false,
      code: 'NETWORK',
      message: expect.any(String),
    });

    fetchMock.mockResolvedValueOnce(jsonResponse(500, {}));
    const unknown = await fetchAdminUsers();
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.code).toBe('UNKNOWN');
  });
});
