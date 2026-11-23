import { SmtpTransportFailure } from '../NodemailerSmtpMailAdapter';
import { BrevoHttpMailAdapter, createBrevoHttpMailAdapter } from '../BrevoHttpMailAdapter';

const intent = {
  to: 'ana@example.com',
  confirmationUrl: 'https://shop.example.com/confirm-email?token=opaque-token',
  expiresAt: new Date('2026-09-05T12:00:00.000Z'),
  idempotencyKey: 'email-confirmation-token:42',
};

describe('BrevoHttpMailAdapter', () => {
  it('posts confirmation email payload to Brevo HTTP API with expected headers and display-name sender', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
    } as Response);
    const timeoutSpy = jest.spyOn(AbortSignal, 'timeout');

    const adapter = new BrevoHttpMailAdapter(
      {
        apiKey: 'xkeysib-secret-test-key',
        from: 'Mundo-3D <no-reply@example.com>',
      },
      fetchMock as unknown as typeof fetch,
    );

    await adapter.sendEmailConfirmation(intent);

    expect(timeoutSpy).toHaveBeenCalledWith(10000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({
      'api-key': 'xkeysib-secret-test-key',
      'content-type': 'application/json',
      accept: 'application/json',
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const parsedBody = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(parsedBody).toEqual({
      sender: { name: 'Mundo-3D', email: 'no-reply@example.com' },
      to: [{ email: 'ana@example.com' }],
      subject: 'Confirmá tu correo electrónico',
      textContent: expect.stringContaining(intent.confirmationUrl),
      htmlContent: expect.stringContaining(intent.confirmationUrl),
    });

    timeoutSpy.mockRestore();
  });

  it('formats bare email sender and empty angle-bracket display name without a name property', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
    } as Response);

    const adapter = createBrevoHttpMailAdapter(
      {
        apiKey: 'xkeysib-secret-test-key',
        from: 'no-reply@example.com',
      },
      fetchMock as unknown as typeof fetch,
    );

    await adapter.sendEmailConfirmation(intent);

    const [, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((JSON.parse(firstInit.body as string) as { sender: unknown }).sender).toEqual({
      email: 'no-reply@example.com',
    });

    const angleAdapter = createBrevoHttpMailAdapter(
      {
        apiKey: 'xkeysib-secret-test-key',
        from: '<no-reply@example.com>',
      },
      fetchMock as unknown as typeof fetch,
    );

    await angleAdapter.sendEmailConfirmation(intent);

    const [, secondInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((JSON.parse(secondInit.body as string) as { sender: unknown }).sender).toEqual({
      email: 'no-reply@example.com',
    });
  });

  it('uses globalThis.fetch when created via createBrevoHttpMailAdapter without explicit fetch', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 201,
    } as Response);

    try {
      const adapter = createBrevoHttpMailAdapter({
        apiKey: 'xkeysib-secret-test-key',
        from: '"Mundo 3D" <no-reply@example.com>',
      });

      await adapter.sendEmailConfirmation(intent);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      const parsedBody = JSON.parse(init.body as string) as { sender: unknown };
      expect(parsedBody.sender).toEqual({ name: 'Mundo 3D', email: 'no-reply@example.com' });
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('throws SmtpTransportFailure on non-OK HTTP status without leaking apiKey or recipient', async () => {
    const apiKey = 'xkeysib-super-secret-value';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: jest.fn().mockResolvedValue(`unauthorized ${apiKey} ${intent.to}`),
    } as unknown as Response);

    const adapter = new BrevoHttpMailAdapter(
      { apiKey, from: 'no-reply@example.com' },
      fetchMock as unknown as typeof fetch,
    );

    let caughtError: unknown;
    try {
      await adapter.sendEmailConfirmation(intent);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(SmtpTransportFailure);
    expect((caughtError as SmtpTransportFailure).outcome).toBe('smtp_failed');
    expect((caughtError as Error).message).not.toContain(apiKey);
    expect((caughtError as Error).message).not.toContain(intent.to);
  });

  it('throws SmtpTransportFailure on network or abort rejection without leaking apiKey or recipient', async () => {
    const apiKey = 'xkeysib-super-secret-value';
    const fetchMock = jest
      .fn()
      .mockRejectedValue(new Error(`TimeoutError sending with ${apiKey} to ${intent.to}`));

    const adapter = new BrevoHttpMailAdapter(
      { apiKey, from: 'no-reply@example.com' },
      fetchMock as unknown as typeof fetch,
    );

    let caughtError: unknown;
    try {
      await adapter.sendEmailConfirmation(intent);
    } catch (error) {
      caughtError = error;
    }

    expect(caughtError).toBeInstanceOf(SmtpTransportFailure);
    expect((caughtError as SmtpTransportFailure).outcome).toBe('smtp_failed');
    expect((caughtError as Error).message).not.toContain(apiKey);
    expect((caughtError as Error).message).not.toContain(intent.to);
  });
});
