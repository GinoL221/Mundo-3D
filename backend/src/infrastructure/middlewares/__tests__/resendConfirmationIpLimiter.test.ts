import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  ipKeyGenerator: jest.requireActual('express-rate-limit').ipKeyGenerator,
}));

describe('resendConfirmationIpLimiter', () => {
  it('configures five accepted resend requests per trusted req.ip hour without account lookup', () => {
    jest.isolateModules(() => require('../resendConfirmationIpLimiter'));
    const options = (rateLimit as jest.Mock).mock.calls.at(-1)[0];
    const req = { ip: '203.0.113.8', body: { email: 'private@example.com' } } as Request;

    expect(options.windowMs).toBe(60 * 60 * 1000);
    expect(options.max).toBe(5);
    expect(options.keyGenerator(req, {} as Response)).toBe('203.0.113.8');
  });

  it('uses the E2E raised limit and IPv6-safe IP key generation', () => {
    const originalMax = process.env.RESEND_CONFIRMATION_IP_LIMIT_MAX;
    process.env.RESEND_CONFIRMATION_IP_LIMIT_MAX = '1000';

    try {
      jest.isolateModules(() => require('../resendConfirmationIpLimiter'));
      const options = (rateLimit as jest.Mock).mock.calls.at(-1)[0];
      const req = { ip: '2001:db8:1234:5678::1' } as Request;

      expect(options.max).toBe(1000);
      expect(options.keyGenerator(req, {} as Response)).toBe(ipKeyGenerator(req.ip ?? ''));
    } finally {
      if (originalMax === undefined) delete process.env.RESEND_CONFIRMATION_IP_LIMIT_MAX;
      else process.env.RESEND_CONFIRMATION_IP_LIMIT_MAX = originalMax;
    }
  });

  it('keeps the sixth-request response generic 202 without account or secret detail', () => {
    jest.isolateModules(() => require('../resendConfirmationIpLimiter'));
    const options = (rateLimit as jest.Mock).mock.calls.at(-1)[0];
    const token = 'opaque-token-should-not-escape';
    const email = 'private@example.com';
    const digest = 'a'.repeat(64);
    const url = `https://app.example/confirm-email?token=${token}`;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;

    options.handler({ ip: '203.0.113.8', body: { email, token, digest, url } } as Request, res);

    expect(res.status).toHaveBeenCalledWith(202);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body).toEqual({
      message: 'If the account is eligible, a confirmation email will be sent.',
    });
    for (const forbidden of [token, email, digest, url, 'limited']) {
      expect(JSON.stringify(body)).not.toContain(forbidden);
    }
  });
});
