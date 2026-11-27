import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  listMyCustomCommissionRequests,
  submitCustomCommissionRequest,
} from './customCommissionRequest.service';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const request = { name: 'A Visitor', email: 'visitor@example.test', idea: 'A small custom figure' };

describe('submitCustomCommissionRequest', () => {
  it('posts JSON without credentials for guests and omits unselected product and blank phone', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    expect(await submitCustomCommissionRequest({ ...request, phone: '   ' })).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/custom-commission-requests$/),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      },
    );
  });

  it('includes the selected product ID and trimmed optional phone', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));
    await submitCustomCommissionRequest({
      ...request,
      phone: '  +54 9 11 0000-0101  ',
      idProduct: 42,
    });
    expect(JSON.parse(fetchMock.mock.calls[0][1]?.body as string)).toEqual({
      ...request,
      phone: '+54 9 11 0000-0101',
      idProduct: 42,
    });
  });

  it('sends credentials and X-CSRF-Token when an authenticated buyer submits', async () => {
    const userCookie = encodeURIComponent(JSON.stringify({ idRole: 2 }));
    vi.stubGlobal('document', { cookie: `m3d_user=${userCookie}; m3d_csrf=buyer-csrf.sig` });
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 201 }));

    expect(await submitCustomCommissionRequest(request)).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/custom-commission-requests$/),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-CSRF-Token': 'buyer-csrf.sig',
        }),
      }),
    );
  });

  it.each([
    [400, 'validation'],
    [429, 'rate-limit'],
    [500, 'server'],
  ] as const)(
    'maps HTTP %i to a safe %s result without exposing response content',
    async (status, reason) => {
      vi.stubGlobal('document', { cookie: '' });
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ email: request.email }), { status }),
      );
      const result = await submitCustomCommissionRequest(request);
      expect(result).toEqual({ ok: false, reason });
      expect(JSON.stringify(result)).not.toContain(request.email);
    },
  );

  it('maps network failures to a safe result', async () => {
    vi.stubGlobal('document', { cookie: '' });
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(request.email));
    expect(await submitCustomCommissionRequest(request)).toEqual({ ok: false, reason: 'network' });
  });
});

describe('listMyCustomCommissionRequests', () => {
  it('returns the buyer commission array on HTTP 200', async () => {
    vi.stubGlobal('document', { cookie: '' });
    const payload = [
      {
        idCustomCommissionRequest: 7,
        name: 'Demo Buyer',
        email: 'buyer@sandbox.invalid',
        phone: '+54 9 11 0000-0101',
        idea: 'Figura personalizada',
        idProduct: 1,
        createdAt: '2026-11-27T12:00:00.000Z',
        expiresAt: '2026-12-27T12:00:00.000Z',
      },
    ];
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(payload), { status: 200 }));

    const result = await listMyCustomCommissionRequests();
    expect(result).toEqual({ ok: true, requests: payload });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/custom-commission-requests\/mine$/),
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('maps 401 to UNAUTHENTICATED and 403 to FORBIDDEN', async () => {
    vi.stubGlobal('document', { cookie: '' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 401 }));
    expect(await listMyCustomCommissionRequests()).toMatchObject({
      ok: false,
      code: 'UNAUTHENTICATED',
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 403 }));
    expect(await listMyCustomCommissionRequests()).toMatchObject({
      ok: false,
      code: 'FORBIDDEN',
    });
  });

  it('maps malformed responses and network errors to ERROR', async () => {
    vi.stubGlobal('document', { cookie: '' });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ notAnArray: true }), { status: 200 }),
    );
    expect(await listMyCustomCommissionRequests()).toMatchObject({ ok: false, code: 'ERROR' });

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('offline'));
    expect(await listMyCustomCommissionRequests()).toMatchObject({ ok: false, code: 'ERROR' });
  });
});
