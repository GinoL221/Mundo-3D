import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConfirmationNetworkError, EmailConfirmationService } from './emailConfirmation.service';

function jsonResponse(status: number, body?: unknown) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
  });
}

describe('EmailConfirmationService', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', { location: { search: '?token=opaque-token' } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not mutate on load, then reads the query token only when explicitly submitted', async () => {
    expect(fetchMock).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(jsonResponse(204));

    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('confirmed');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/email-confirmation/confirm'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'opaque-token' }),
      }),
    );
  });

  it('maps missing or invalid query tokens and generic 400 responses to the same invalid outcome', async () => {
    vi.stubGlobal('window', { location: { search: '' } });
    fetchMock.mockResolvedValueOnce(jsonResponse(400)).mockResolvedValueOnce(jsonResponse(400));

    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('invalid');
    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('invalid');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/email-confirmation/confirm'),
      expect.objectContaining({ body: JSON.stringify({ token: '' }) }),
    );
  });

  it('maps 429 on confirm to rate-limited instead of invalid', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: 'Too many requests' }));

    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe(
      'rate-limited',
    );
  });

  it('allows repeated explicit confirmation submits and keeps 5xx responses retryable', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204)).mockResolvedValueOnce(jsonResponse(204));

    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('confirmed');
    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('confirmed');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockResolvedValueOnce(jsonResponse(500));
    await expect(EmailConfirmationService.confirmFromCurrentLocation()).rejects.toBeInstanceOf(
      ConfirmationNetworkError,
    );
  });

  it('posts only the resend email and accepts generic 202 responses, including limited cases', async () => {
    fetchMock.mockResolvedValue(jsonResponse(202, { message: 'accepted' }));

    await expect(EmailConfirmationService.resend('ada@example.com')).resolves.toEqual({
      status: 'accepted',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/email-confirmation/resend'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ada@example.com' }),
      }),
    );
  });

  it('maps 400 resend responses to a validation outcome with the backend field message', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, {
        errors: [{ path: 'email', msg: 'Ingresá un correo válido' }],
      }),
    );

    await expect(EmailConfirmationService.resend('bad-email')).resolves.toEqual({
      status: 'validation-error',
      fieldErrors: { email: 'Ingresá un correo válido' },
      message: 'Ingresá un correo válido',
    });
  });

  it('falls back to a Spanish email error when a 400 resend response has no parseable body', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 400 }));

    await expect(EmailConfirmationService.resend('bad-email')).resolves.toEqual({
      status: 'validation-error',
      fieldErrors: { email: 'Ingresá un correo válido' },
      message: 'Ingresá un correo válido',
    });
  });

  it('maps 429 on resend to rate-limited', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(429, { error: 'Too many requests' }));

    await expect(EmailConfirmationService.resend('ada@example.com')).resolves.toEqual({
      status: 'rate-limited',
    });
  });

  it('throws ConfirmationNetworkError on 5xx resend responses', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(503));

    await expect(EmailConfirmationService.resend('ada@example.com')).rejects.toBeInstanceOf(
      ConfirmationNetworkError,
    );
  });

  it('keeps network failure retryable without browser persistence or credentials', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'));

    await expect(EmailConfirmationService.resend('ada@example.com')).rejects.toBeInstanceOf(
      ConfirmationNetworkError,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({ credentials: expect.anything() }),
    );
  });
});
