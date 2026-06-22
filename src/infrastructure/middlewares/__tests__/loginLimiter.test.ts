import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    return jest.fn((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  });
});

describe('loginLimiter middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses default values (max=5, windowMs=15min) if env vars are not set', () => {
    delete process.env.LOGIN_LIMIT_MAX;
    delete process.env.LOGIN_LIMIT_WINDOW;

    // Load the module after modifying env vars
    let loginLimiter: any;
    let rateLimitMock: any;
    jest.isolateModules(() => {
      loginLimiter = require('../loginLimiter').default;
      rateLimitMock = require('express-rate-limit');
    });

    expect(loginLimiter).toBeDefined();
    expect(typeof loginLimiter).toBe('function');

    // Check that express-rate-limit was configured correctly
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
      })
    );

    // Verify it behaves as a middleware function
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();
    loginLimiter(req, res, next);
    expect(loginLimiter).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('correctly loads and configures with custom env values', () => {
    process.env.LOGIN_LIMIT_MAX = '10';
    process.env.LOGIN_LIMIT_WINDOW = '60000'; // 1 minute

    let loginLimiter: any;
    let rateLimitMock: any;
    jest.isolateModules(() => {
      loginLimiter = require('../loginLimiter').default;
      rateLimitMock = require('express-rate-limit');
    });

    expect(loginLimiter).toBeDefined();
    expect(typeof loginLimiter).toBe('function');

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 60000,
        max: 10,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
      })
    );

    // Verify it behaves as a middleware function
    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();
    loginLimiter(req, res, next);
    expect(loginLimiter).toHaveBeenCalledWith(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

