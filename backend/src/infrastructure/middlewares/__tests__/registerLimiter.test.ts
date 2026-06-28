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
