import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomCommissionRequestAdminApiError, listCustomCommissionRequests } from './customCommissionRequest.admin.service';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubCookie() {
  vi.stubGlobal('document', { cookie: '' });
}

describe('listCustomCommissionRequests', () => {
  it('uses authenticated GET and returns request records', async () => {
    stubCookie();
    const requests = [{ id: 1, name: 'A Visitor', email: 'visitor@example.test', idea: 'A small figure', idProduct: null, createdAt: '2026-01-01T00:00:00.000Z' }];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(requests), { status: 200 }));
    expect(await listCustomCommissionRequests()).toEqual(requests);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/custom-commission-requests$/), expect.objectContaining({ method: 'GET', credentials: 'include' }));
  });

  it('returns an empty list for malformed or non-array payloads', async () => {
    stubCookie();
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{ invalid json', { status: 200 }));
    await expect(listCustomCommissionRequests()).resolves.toEqual([]);

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify({ requests: [{ id: 1 }] }), { status: 200 }));
    await expect(listCustomCommissionRequests()).resolves.toEqual([]);
  });

  it('surfaces HTTP status for page-level unauthorized handling', async () => {
    stubCookie();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));
    await expect(listCustomCommissionRequests()).rejects.toMatchObject({ name: 'CustomCommissionRequestAdminApiError', status: 401 });
  });

  it('maps other HTTP errors and network failures', async () => {
    stubCookie();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(listCustomCommissionRequests()).rejects.toBeInstanceOf(CustomCommissionRequestAdminApiError);
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    await expect(listCustomCommissionRequests()).rejects.toThrow('offline');
  });
});
