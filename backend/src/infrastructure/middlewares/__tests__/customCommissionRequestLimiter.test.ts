import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

jest.mock('express-rate-limit', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  ipKeyGenerator: jest.requireActual('express-rate-limit').ipKeyGenerator,
}));

describe('customCommissionRequestLimiter', () => {
  it('limits each trusted client IP to five requests per hour without reading request data', () => {
    jest.isolateModules(() => require('../customCommissionRequestLimiter'));
    const options = (rateLimit as jest.Mock).mock.calls.at(-1)[0];
    const req = { ip: '203.0.113.8', body: { email: 'private@example.com' } } as Request;
    expect(options.windowMs).toBe(60 * 60 * 1000);
    expect(options.max).toBe(5);
    expect(options.keyGenerator(req, {} as Response)).toBe('203.0.113.8');
  });

  it('returns a generic response without PII when the client exceeds the limit', () => {
    jest.isolateModules(() => require('../customCommissionRequestLimiter'));
    const options = (rateLimit as jest.Mock).mock.calls.at(-1)[0];
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() } as unknown as Response;
    options.handler({ ip: '203.0.113.8', body: { email: 'private@example.com' } } as Request, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(JSON.stringify((res.json as jest.Mock).mock.calls[0][0])).not.toContain('private@example.com');
  });
});
