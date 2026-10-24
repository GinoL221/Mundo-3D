const mockCreateTransport = jest.fn();

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: mockCreateTransport },
}));

const { NodemailerSmtpMailAdapter, SmtpTransportFailure, createNodemailerSmtpMailAdapter } =
  require('../NodemailerSmtpMailAdapter') as {
    NodemailerSmtpMailAdapter: new (input: {
      transport: { sendMail: (message: unknown) => Promise<void> };
      from: string;
    }) => {
      sendEmailConfirmation(intent: {
        to: string;
        confirmationUrl: string;
        expiresAt: Date;
        idempotencyKey: string;
      }): Promise<void>;
    };
    SmtpTransportFailure: new (outcome: 'smtp_failed') => Error;
    createNodemailerSmtpMailAdapter: (config: {
      host: string;
      port: number;
      secure: boolean;
      user: string | undefined;
      password: string | undefined;
      from: string;
    }) => {
      sendEmailConfirmation(intent: {
        to: string;
        confirmationUrl: string;
        expiresAt: Date;
        idempotencyKey: string;
      }): Promise<void>;
    };
  };

const intent = {
  to: 'ana@example.com',
  confirmationUrl: 'https://shop.example.com/confirm-email?token=opaque-token',
  expiresAt: new Date('2026-09-05T12:00:00.000Z'),
  idempotencyKey: 'email-confirmation-token:42',
};

describe('NodemailerSmtpMailAdapter', () => {
  it('submits a provider-neutral confirmation intent through the injected SMTP transport', async () => {
    const transport = { sendMail: jest.fn().mockResolvedValue(undefined) };
    const adapter = new NodemailerSmtpMailAdapter({
      transport,
      from: 'Mundo-3D <no-reply@example.com>',
    });

    await adapter.sendEmailConfirmation(intent);

    expect(transport.sendMail).toHaveBeenCalledWith({
      from: 'Mundo-3D <no-reply@example.com>',
      to: 'ana@example.com',
      subject: 'Confirma tu correo electrónico',
      text: expect.stringContaining(intent.confirmationUrl),
      html: expect.stringContaining('https://shop.example.com/confirm-email?token=opaque-token'),
      headers: { 'X-Idempotency-Key': 'email-confirmation-token:42' },
    });
  });

  it('maps a transport rejection to an allowlisted failure without exposing SMTP or recipient details', async () => {
    const transport = {
      sendMail: jest
        .fn()
        .mockRejectedValue(new Error('ECONNREFUSED smtp://secret@localhost for ana@example.com')),
    };
    const adapter = new NodemailerSmtpMailAdapter({ transport, from: 'no-reply@example.com' });

    await expect(adapter.sendEmailConfirmation(intent)).rejects.toEqual(
      new SmtpTransportFailure('smtp_failed'),
    );
    await expect(adapter.sendEmailConfirmation(intent)).rejects.not.toThrow(
      /ECONNREFUSED|secret|ana@example.com/,
    );
  });
});

describe('createNodemailerSmtpMailAdapter', () => {
  beforeEach(() => {
    mockCreateTransport.mockReset();
  });

  it('maps SMTP configuration to the Nodemailer transport without opening a network connection', async () => {
    const transport = { sendMail: jest.fn().mockResolvedValue(undefined) };
    mockCreateTransport.mockReturnValue(transport);
    const config = {
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      user: 'smtp-user',
      password: 'smtp-password',
      from: 'Mundo-3D <no-reply@example.com>',
    };

    const adapter = createNodemailerSmtpMailAdapter(config);

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'smtp-user', pass: 'smtp-password' },
    });

    await adapter.sendEmailConfirmation(intent);
    expect(transport.sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: config.from, to: intent.to }),
    );
  });
});
