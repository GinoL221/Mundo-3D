import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CustomCommissionRequestAdminApiError,
  listCustomCommissionRequests,
} from './customCommissionRequest.admin.service';
import type { CustomCommissionRequestDTO } from './customCommissionRequest.admin.service';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubCookie() {
  vi.stubGlobal('document', { cookie: '' });
}

describe('listCustomCommissionRequests', () => {
  it('uses authenticated GET and returns the API JSON array', async () => {
    stubCookie();
    const requests: CustomCommissionRequestDTO[] = [
      {
        idCustomCommissionRequest: 1,
        name: 'A Visitor',
        email: 'visitor@example.test',
        idea: 'A small figure',
        idProduct: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2026-01-31T00:00:00.000Z',
      },
    ];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(requests), { status: 200 }));

    const listed = await listCustomCommissionRequests();
    expect(listed).toEqual(requests);
    expect(listed[0]?.idCustomCommissionRequest).toBe(1);
    expect(listed[0]?.expiresAt).toBe('2026-01-31T00:00:00.000Z');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/custom-commission-requests$/),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('rejects malformed or non-array payloads instead of reporting an empty inbox', async () => {
    stubCookie();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('{ invalid json', { status: 200 }),
    );
    const malformedError = await listCustomCommissionRequests().then(
      () => null,
      (cause: unknown) => cause,
    );

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ requests: [{ id: 1 }] }), { status: 200 }),
    );
    const nonArrayError = await listCustomCommissionRequests().then(
      () => null,
      (cause: unknown) => cause,
    );

    expect(malformedError).toBeInstanceOf(Error);
    expect(malformedError).toMatchObject({ message: 'Unexpected response format' });
    expect(nonArrayError).toBeInstanceOf(Error);
    expect(nonArrayError).toMatchObject({ message: 'Unexpected response format' });
  });

  it('preserves 401 status for page-level unauthorized handling', async () => {
    stubCookie();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

    await expect(listCustomCommissionRequests()).rejects.toMatchObject({
      name: 'CustomCommissionRequestAdminApiError',
      status: 401,
    });
  });

  it('maps server errors and propagates network failures', async () => {
    stubCookie();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }),
    );

    const error = await listCustomCommissionRequests().then(
      () => null,
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(CustomCommissionRequestAdminApiError);
    expect(error).toMatchObject({ message: 'Unavailable', status: 503 });

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    await expect(listCustomCommissionRequests()).rejects.toThrow('offline');
  });
});
