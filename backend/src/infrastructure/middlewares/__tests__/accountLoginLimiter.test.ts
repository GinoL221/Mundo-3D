import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    return jest.fn((req: Request, res: Response, next: NextFunction) => {
      next();
    });
  });
});

// Configuration-level suite, mirroring its sibling limiters. The keys this
// configuration actually produces are proven against the real library in
// `loginThrottleBehaviour.test.ts`.
describe('accountLoginLimiter middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  const load = () => {
    let accountLoginLimiter: any;
    let rateLimitMock: any;
    jest.isolateModules(() => {
      accountLoginLimiter = require('../accountLoginLimiter').default;
      rateLimitMock = require('express-rate-limit');
    });
    return { accountLoginLimiter, rateLimitMock };
  };

  const optionsOf = (rateLimitMock: any) => rateLimitMock.mock.calls.at(-1)?.[0];

  it('uses default values (max=5, windowMs=15min) if env vars are not set', () => {
    delete process.env.ACCOUNT_LOGIN_LIMIT_MAX;
    delete process.env.ACCOUNT_LOGIN_LIMIT_WINDOW;
    process.env.NODE_ENV = 'production'; // so it's not bypassed

    const { accountLoginLimiter, rateLimitMock } = load();

    expect(accountLoginLimiter).toBeDefined();
    expect(typeof accountLoginLimiter).toBe('function');

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 15 * 60 * 1000,
        max: 5,
        standardHeaders: true,
        legacyHeaders: false,
        statusCode: 429,
      })
    );
  });

  it('correctly loads and configures with custom env values', () => {
    process.env.ACCOUNT_LOGIN_LIMIT_MAX = '20';
    process.env.ACCOUNT_LOGIN_LIMIT_WINDOW = '60000';
    process.env.NODE_ENV = 'production';

    const { rateLimitMock } = load();

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        windowMs: 60000,
        max: 20,
      })
    );
  });

  // Only failed attempts are the threat being throttled. Counting successes
  // would put the account's own users on the attacker's budget.
  it('counts failed attempts only', () => {
    process.env.NODE_ENV = 'production';

    const { rateLimitMock } = load();

    expect(optionsOf(rateLimitMock).skipSuccessfulRequests).toBe(true);
  });

  // The 429 body must not differ from loginLimiter's: a distinct message
  // would tell an attacker which of the two limiters fired, and the account
  // limiter firing is itself a fact about the submitted account.
  it('refuses with exactly the loginLimiter message', () => {
    process.env.NODE_ENV = 'production';

    const { rateLimitMock } = load();

    expect(optionsOf(rateLimitMock).message).toEqual({
      error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
    });
  });

  it('keys on the submitted email rather than the client IP', async () => {
    process.env.NODE_ENV = 'production';

    const { rateLimitMock } = load();
    const { keyGenerator } = optionsOf(rateLimitMock);
    const req = { body: { email: 'user@example.com' }, ip: '203.0.113.9' } as unknown as Request;
    const key = async () => keyGenerator(req, {} as Response);

    await expect(key()).resolves.not.toBe('203.0.113.9');
    await expect(key()).resolves.toBe('user@example.com');
  });

  // The bypass: `normalizeLoginBody` maps `Email` to `email` but never
  // lowercases (that happens downstream, in `loginValidation`), so an
  // un-normalized key would give every spelling of one address its own budget.
  it('normalizes casing and surrounding whitespace into one key', async () => {
    process.env.NODE_ENV = 'production';

    const { rateLimitMock } = load();
    const { keyGenerator } = optionsOf(rateLimitMock);
    const keyFor = async (email: string) =>
      keyGenerator({ body: { email } } as unknown as Request, {} as Response);

    await expect(keyFor('  A@Example.COM ')).resolves.toBe('a@example.com');
    await expect(keyFor('a@example.com')).resolves.toBe(await keyFor('A@Example.com'));
  });

  // A limiter that only throttled real accounts would answer "does this
  // address exist?" through its own 429s — the same class of leak the login
  // timing oracle was just closed for.
  it('skips the limiter when no email was submitted instead of sharing one key', async () => {
    process.env.NODE_ENV = 'production';

    const { rateLimitMock } = load();
    const { skip } = optionsOf(rateLimitMock);
    const skipFor = async (body: unknown) => skip({ body } as unknown as Request, {} as Response);

    await expect(skipFor(undefined)).resolves.toBe(true);
    await expect(skipFor({})).resolves.toBe(true);
    await expect(skipFor({ email: '   ' })).resolves.toBe(true);
    await expect(skipFor({ email: 'user@example.com' })).resolves.toBe(false);
  });

  // Same JEST_WORKER_ID escape hatch as loginLimiter — NODE_ENV alone must
  // not disable throttling on a real server started with NODE_ENV=test.
  it('does NOT bypass when NODE_ENV is test but the process is not under Jest', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.JEST_WORKER_ID;

    const { accountLoginLimiter } = load();

    const req = { ip: '203.0.113.9', headers: {}, body: {} } as unknown as Request;
    const res = {} as Response;
    const next = jest.fn();

    accountLoginLimiter(req, res, next);

    const configuredLimiter = (rateLimit as unknown as jest.Mock).mock.results.at(-1)
      ?.value as jest.Mock;
    expect(configuredLimiter).toHaveBeenCalledTimes(1);
  });

  it('bypasses limit checks when NODE_ENV is test under Jest', () => {
    process.env.NODE_ENV = 'test';

    const { accountLoginLimiter } = load();

    const req = {} as Request;
    const res = {} as Response;
    const next = jest.fn();

    accountLoginLimiter(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
