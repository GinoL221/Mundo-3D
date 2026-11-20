import { loadEmailConfirmationConfig } from '../emailConfirmationConfig';

describe('email confirmation public origin configuration', () => {
  it('accepts the deployment-owned PUBLIC_APP_URL and builds an absolute confirmation URL', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'https://shop.example.com',
    });

    expect(config.publicOrigin.buildConfirmationUrl('opaque-token')).toBe(
      'https://shop.example.com/confirm-email?token=opaque-token',
    );
    expect(config.publicOrigin.buildConfirmationUrl('token with+/=?#characters')).toBe(
      'https://shop.example.com/confirm-email?token=token+with%2B%2F%3D%3F%23characters',
    );
  });

  it.each([
    'https://user:pass@shop.example.com',
    'https://shop.example.com/path',
    'https://shop.example.com/?preview=true',
    'https://shop.example.com/#fragment',
    'http://shop.example.com',
    'not an absolute URL',
    'ftp://shop.example.com',
    'https://shop.example.com/%2Fadmin',
    'http://localhost.evil',
  ])('rejects an untrusted PUBLIC_APP_URL: %s', (PUBLIC_APP_URL) => {
    expect(() => loadEmailConfirmationConfig({ PUBLIC_APP_URL })).toThrow();
  });

  it('allows an HTTP localhost origin for the local demo only', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'http://localhost:4321',
      SMTP_HOST: 'localhost',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'Mundo-3D <no-reply@example.test>',
    });

    expect(config.publicOrigin.buildConfirmationUrl('opaque-token')).toBe(
      'http://localhost:4321/confirm-email?token=opaque-token',
    );
  });

  it('parses validated SMTP settings while keeping credentials optional for local Mailpit', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'https://shop.example.com',
      SMTP_HOST: 'mailpit',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'Mundo-3D <no-reply@example.test>',
    });

    expect((config as { smtp?: unknown }).smtp).toEqual({
      host: 'mailpit',
      port: 1025,
      secure: false,
      user: undefined,
      password: undefined,
      from: 'Mundo-3D <no-reply@example.test>',
    });
  });

  it.each([
    { SMTP_HOST: '', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_FROM: 'no-reply@example.test' },
    {
      SMTP_HOST: 'mailpit',
      SMTP_PORT: '0',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'no-reply@example.test',
    },
    {
      SMTP_HOST: 'mailpit',
      SMTP_PORT: '1025.5',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'no-reply@example.test',
    },
    {
      SMTP_HOST: 'mailpit',
      SMTP_PORT: '1025',
      SMTP_SECURE: 'sometimes',
      SMTP_FROM: 'no-reply@example.test',
    },
    { SMTP_HOST: 'mailpit', SMTP_PORT: '1025', SMTP_SECURE: 'false', SMTP_FROM: '' },
  ])('rejects invalid required SMTP configuration: %o', (smtp) => {
    expect(() =>
      loadEmailConfirmationConfig({ PUBLIC_APP_URL: 'https://shop.example.com', ...smtp }),
    ).toThrow();
  });

  it('selects brevo-http automatically when MAIL_DRIVER is unset and BREVO_API_KEY is non-empty', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'https://shop.example.com',
      BREVO_API_KEY: 'xkeysib-test-key',
      MAIL_FROM: 'Mundo-3D <no-reply@example.com>',
    });

    expect(config.brevo).toEqual({
      apiKey: 'xkeysib-test-key',
      from: 'Mundo-3D <no-reply@example.com>',
    });
    expect(config.smtp).toBeUndefined();
  });

  it('falls back to SMTP_FROM when MAIL_FROM is unset in brevo-http mode', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'https://shop.example.com',
      MAIL_DRIVER: 'brevo-http',
      BREVO_API_KEY: 'xkeysib-test-key',
      SMTP_FROM: 'no-reply@example.com',
    });

    expect(config.brevo).toEqual({
      apiKey: 'xkeysib-test-key',
      from: 'no-reply@example.com',
    });
    expect(config.smtp).toBeUndefined();
  });

  it('prefers MAIL_FROM over SMTP_FROM when both are set in brevo-http mode', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'https://shop.example.com',
      MAIL_DRIVER: 'brevo-http',
      BREVO_API_KEY: 'xkeysib-test-key',
      MAIL_FROM: 'Mundo-3D <primary@example.com>',
      SMTP_FROM: 'fallback@example.com',
    });

    expect(config.brevo).toEqual({
      apiKey: 'xkeysib-test-key',
      from: 'Mundo-3D <primary@example.com>',
    });
  });

  it.each([
    { MAIL_DRIVER: 'brevo-http', MAIL_FROM: 'no-reply@example.com' },
    { MAIL_DRIVER: 'brevo-http', BREVO_API_KEY: '   ', MAIL_FROM: 'no-reply@example.com' },
    { MAIL_DRIVER: 'brevo-http', BREVO_API_KEY: 'xkeysib-test-key' },
    { MAIL_DRIVER: 'brevo-http', BREVO_API_KEY: 'xkeysib-test-key', MAIL_FROM: 'not-an-email' },
    {
      MAIL_DRIVER: 'brevo-http',
      BREVO_API_KEY: 'xkeysib-test-key',
      MAIL_FROM: 'Mundo-3D <>',
    },
    { MAIL_DRIVER: 'sendgrid', BREVO_API_KEY: 'xkeysib-test-key', MAIL_FROM: 'a@example.com' },
  ])('rejects invalid Brevo or MAIL_DRIVER configuration: %o', (extra) => {
    expect(() =>
      loadEmailConfirmationConfig({ PUBLIC_APP_URL: 'https://shop.example.com', ...extra }),
    ).toThrow();
  });

  it('respects explicit MAIL_DRIVER=smtp even when BREVO_API_KEY is present', () => {
    const config = loadEmailConfirmationConfig({
      PUBLIC_APP_URL: 'https://shop.example.com',
      MAIL_DRIVER: 'smtp',
      BREVO_API_KEY: 'xkeysib-test-key',
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '587',
      SMTP_SECURE: 'false',
      SMTP_FROM: 'no-reply@example.com',
    });

    expect(config.smtp).toEqual({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: undefined,
      password: undefined,
      from: 'no-reply@example.com',
    });
    expect(config.brevo).toBeUndefined();
  });

  it('requires SMTP settings when MAIL_DRIVER=smtp is explicitly set', () => {
    expect(() =>
      loadEmailConfirmationConfig({
        PUBLIC_APP_URL: 'https://shop.example.com',
        MAIL_DRIVER: 'smtp',
      }),
    ).toThrow();
  });
});
