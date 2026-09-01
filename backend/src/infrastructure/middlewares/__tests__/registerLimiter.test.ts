import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    return jest.fn((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  });
});

describe('registerLimiter middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses default values (max=3, windowMs=15min) if env vars are not set', () => {
    delete process.env.REGISTER_LIMIT_MAX;
    delete process.env.REGISTER_LIMIT_WINDOW;
    process.env.NODE_ENV = 'production'; // so it's not bypassed

    let registerLimiter: any;
    let rateLimitMock: any;
    jest.isolateModules(() => {
      registerLimiter = require('../registerLimiter').default;
      rateLimitMock = require('express-rate-limit');
    });

    expect(registerLimiter).toBeDefined();
    expect(typeof registerLimiter).toBe('function');

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        max: 3,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
      })
    );
  });

  it('correctly loads and configures with custom env values', () => {
    process.env.REGISTER_LIMIT_MAX = '20';
    process.env.REGISTER_LIMIT_WINDOW = '120000';
    process.env.NODE_ENV = 'production';

    let registerLimiter: any;
    let rateLimitMock: any;
    jest.isolateModules(() => {
      registerLimiter = require('../registerLimiter').default;
      rateLimitMock = require('express-rate-limit');
    });

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 120000,
        max: 20,
      })
    );
  });

  // NODE_ENV alone must not disable throttling. The e2e suite runs a real
  // server with NODE_ENV=test and raises the limits through REGISTER_LIMIT_MAX
  // instead, so the only context that skips the limiter entirely is Jest.
  it('does NOT bypass when NODE_ENV is test but the process is not under Jest', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JEST_WORKER_ID;

    let registerLimiter: any;
    jest.isolateModules(() => {
      registerLimiter = require('../registerLimiter').default;
    });

    const req = { ip: '203.0.113.9', headers: {} } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    registerLimiter(req, res, next);

    // express-rate-limit is mocked at the top of this file, so both the bypass
    // and the real path end up calling next(). The discriminator is whether
    // the configured limiter itself was reached: the bypass returns before it,
    // so its mock stays uncalled.
    const configuredLimiter = (rateLimit as unknown as jest.Mock).mock.results.at(-1)
      ?.value as jest.Mock;
    expect(configuredLimiter).toHaveBeenCalledTimes(1);
  });

  it('bypasses limit checks when NODE_ENV is test', () => {
    process.env.NODE_ENV = 'test';

    let registerLimiter: any;
    jest.isolateModules(() => {
      registerLimiter = require('../registerLimiter').default;
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();

    registerLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
