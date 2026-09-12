import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Deliberately dynamic: the GREEN slice creates this module, so Vitest—not the
// language server—records its current absence as the intentional RED failure.
const confirmationModulePath = './emailConfirmation.service';
const { ConfirmationNetworkError, EmailConfirmationService } = await import(confirmationModulePath);

function response(status: number) {
  return { ok: status >= 200 && status < 300, status };
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
    fetchMock.mockResolvedValue(response(204));

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
    fetchMock.mockResolvedValueOnce(response(400)).mockResolvedValueOnce(response(400));

    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('invalid');
    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('invalid');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/email-confirmation/confirm'),
      expect.objectContaining({ body: JSON.stringify({ token: '' }) }),
    );
  });

  it('allows repeated explicit confirmation submits and keeps 5xx responses retryable', async () => {
    fetchMock.mockResolvedValueOnce(response(204)).mockResolvedValueOnce(response(204));

    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('confirmed');
    await expect(EmailConfirmationService.confirmFromCurrentLocation()).resolves.toBe('confirmed');
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockResolvedValueOnce(response(500));
    await expect(EmailConfirmationService.confirmFromCurrentLocation()).rejects.toBeInstanceOf(
      ConfirmationNetworkError,
    );
  });

  it('posts only the resend email and accepts generic 202 responses, including limited cases', async () => {
    fetchMock.mockResolvedValue(response(202));

    await expect(EmailConfirmationService.resend('ada@example.com')).resolves.toBe('accepted');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/email-confirmation/resend'),
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'ada@example.com' }),
      }),
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
