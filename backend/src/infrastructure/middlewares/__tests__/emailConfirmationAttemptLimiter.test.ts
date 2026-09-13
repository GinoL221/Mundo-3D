import rateLimit from 'express-rate-limit';

jest.mock('express-rate-limit', () => jest.fn(() => jest.fn()));

describe('emailConfirmationAttemptLimiter', () => {
  it('configures a 30-attempt, 15-minute trusted-IP window', () => {
    jest.isolateModules(() => require('../emailConfirmationAttemptLimiter'));
    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        max: 30,
        standardHeaders: true,
        legacyHeaders: false,
      }),
    );
  });

  it('keeps the limited response generic when the request contains secret material', () => {
    jest.isolateModules(() => require('../emailConfirmationAttemptLimiter'));
    const options = (rateLimit as jest.Mock).mock.calls.at(-1)[0];
    const plaintext = 'opaque-token-should-not-escape';
    const email = 'private@example.com';
    const digest = 'a'.repeat(64);
    const confirmationUrl = `https://app.example/confirm-email?token=${plaintext}`;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    options.handler(
      { body: { token: plaintext }, query: { token: plaintext }, headers: { email } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email confirmation token' });
    const serializedBody = JSON.stringify(res.json.mock.calls[0][0]);
    for (const forbidden of [plaintext, email, digest, confirmationUrl]) {
      expect(serializedBody).not.toContain(forbidden);
    }
  });
});
