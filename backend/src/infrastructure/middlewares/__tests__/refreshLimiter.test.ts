import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    return jest.fn((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  });
});

describe('refreshLimiter middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses default values (max=10, windowMs=15min) if env vars are not set', () => {
    delete process.env.REFRESH_LIMIT_MAX;
    delete process.env.REFRESH_LIMIT_WINDOW;
    process.env.NODE_ENV = 'production'; // so it's not bypassed

    let refreshLimiter: any;
    let rateLimitMock: any;
    jest.isolateModules(() => {
      refreshLimiter = require('../refreshLimiter').default;
      rateLimitMock = require('express-rate-limit');
    });

    expect(refreshLimiter).toBeDefined();
    expect(typeof refreshLimiter).toBe('function');

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
      })
    );

    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();
    refreshLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('correctly loads and configures with custom env values', () => {
    process.env.REFRESH_LIMIT_MAX = '20';
    process.env.REFRESH_LIMIT_WINDOW = '60000';
    process.env.NODE_ENV = 'production';

    let refreshLimiter: any;
    let rateLimitMock: any;
    jest.isolateModules(() => {
      refreshLimiter = require('../refreshLimiter').default;
      rateLimitMock = require('express-rate-limit');
    });

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 60000,
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
      })
    );

    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();
    refreshLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  // Same JEST_WORKER_ID escape hatch as loginLimiter — NODE_ENV alone must
  // not disable throttling on the refresh endpoint either.
  it('does NOT bypass when NODE_ENV is test but the process is not under Jest', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JEST_WORKER_ID;

    let refreshLimiter: any;
    jest.isolateModules(() => {
      refreshLimiter = require('../refreshLimiter').default;
    });

    const req = { ip: '203.0.113.9', headers: {} } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    refreshLimiter(req, res, next);

    const configuredLimiter = (rateLimit as unknown as jest.Mock).mock.results.at(-1)
      ?.value as jest.Mock;
    expect(configuredLimiter).toHaveBeenCalledTimes(1);
  });

  it('bypasses limit checks when NODE_ENV is test under Jest', () => {
    process.env.NODE_ENV = 'test';

    let refreshLimiter: any;
    jest.isolateModules(() => {
      refreshLimiter = require('../refreshLimiter').default;
    });

    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();

    refreshLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
