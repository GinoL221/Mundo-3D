import request from 'supertest';
import express, { Express, Request, RequestHandler, Response } from 'express';

// Behavioural counterpart to the per-limiter unit suites. Those mock
// `express-rate-limit` and assert the options object, which proves the
// configuration and nothing about the buckets those options produce. The
// per-account limiter's entire value lives in its key function, so it has to
// be observed sorting real requests into real buckets — no library mock here.

const TOO_MANY_LOGIN_ATTEMPTS =
  'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.';

type LimiterName = 'loginLimiter' | 'accountLoginLimiter';

// Every limiter reads its window and ceiling from process.env once at module
// load, and re-checks the Jest short-circuit (NODE_ENV === 'test' &&
// JEST_WORKER_ID) on every request. So NODE_ENV has to stay 'production' for
// the requests too, not just for the require — restoring it in between would
// silently hand every assertion a bypassed limiter that always calls next().
const originalEnv = process.env;

beforeEach(() => {
  process.env = { ...originalEnv, NODE_ENV: 'production' };
});

afterEach(() => {
  process.env = originalEnv;
});

const loadLimiter = (name: LimiterName, env: Record<string, string>): RequestHandler => {
  Object.assign(process.env, env);

  let middleware!: RequestHandler;
  jest.isolateModules(() => {
    middleware = require(`../${name}`).default;
  });

  return middleware;
};

// Stand-in for the login route: 401 is a failed attempt, 200 a successful
// one, chosen per request by a header so one app can serve both. Exactly one
// proxy hop is trusted, as production does, so a test can pose as a
// distributed attacker by varying X-Forwarded-For.
const buildApp = (...middlewares: RequestHandler[]): Express => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.post('/login', ...middlewares, (req: Request, res: Response) => {
    const succeeded = req.get('x-outcome') === 'success';
    res.status(succeeded ? 200 : 401).json({ ok: succeeded });
  });
  return app;
};

type Attempt = { email?: string; outcome?: 'success' | 'failure'; ip?: string };

// `skipSuccessfulRequests` refunds a hit on the response's 'finish' event, so
// the refund settles a microtask after supertest resolves. Draining the event
// loop between attempts keeps the sequence deterministic.
const attempt = async (app: Express, { email, outcome = 'failure', ip }: Attempt = {}) => {
  const pending = request(app).post('/login').set('x-outcome', outcome);
  if (ip) pending.set('X-Forwarded-For', ip);

  const response = await pending.send(email === undefined ? {} : { email });
  await new Promise((resolve) => setImmediate(resolve));
  return response;
};

describe('per-account login throttling', () => {
  it('gives each submitted email its own bucket', async () => {
    const app = buildApp(loadLimiter('accountLoginLimiter', { ACCOUNT_LOGIN_LIMIT_MAX: '2' }));

    expect((await attempt(app, { email: 'victim@example.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'victim@example.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'victim@example.com' })).status).toBe(429);

    // A different account is untouched by the first one's exhausted budget.
    expect((await attempt(app, { email: 'other@example.com' })).status).toBe(401);
  });

  // The bypass this limiter exists to close. `normalizeLoginBody` copies
  // `Email` to `email` but never lowercases — that happens later, in
  // `loginValidation`, downstream of the limiter. So the raw body value
  // arrives with whatever casing and padding the client sent, and an
  // un-normalized key would hand an attacker a fresh budget per spelling.
  it('collapses capitalization and surrounding whitespace into one bucket', async () => {
    const app = buildApp(loadLimiter('accountLoginLimiter', { ACCOUNT_LOGIN_LIMIT_MAX: '2' }));

    expect((await attempt(app, { email: 'a@b.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'A@B.com' })).status).toBe(401);

    // Third spelling of the same address. If casing or padding opened a fresh
    // bucket this would be another 401 and the limiter would be decorative.
    expect((await attempt(app, { email: '  a@b.com  ' })).status).toBe(429);
  });

  it('lets an email-less request through without creating a shared bucket', async () => {
    const app = buildApp(loadLimiter('accountLoginLimiter', { ACCOUNT_LOGIN_LIMIT_MAX: '1' }));

    for (let i = 0; i < 4; i += 1) {
      expect((await attempt(app)).status).toBe(401);
    }
    expect((await attempt(app, { email: '   ' })).status).toBe(401);

    // None of those had an account to be counted against, so a real address
    // still arrives with a full budget instead of an already-spent shared one.
    expect((await attempt(app, { email: 'fresh@example.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'fresh@example.com' })).status).toBe(429);
  });

  it('throttles one account even when each attempt arrives from a different IP', async () => {
    const app = buildApp(
      loadLimiter('loginLimiter', { LOGIN_LIMIT_MAX: '10' }),
      loadLimiter('accountLoginLimiter', { ACCOUNT_LOGIN_LIMIT_MAX: '3' })
    );

    for (let i = 0; i < 3; i += 1) {
      const spread = await attempt(app, { email: 'victim@example.com', ip: `203.0.113.${i + 1}` });
      expect(spread.status).toBe(401);
    }

    // A fourth source IP with an untouched per-IP budget is still refused:
    // the account's own budget is what is spent.
    const distributed = await attempt(app, { email: 'victim@example.com', ip: '203.0.113.99' });
    expect(distributed.status).toBe(429);

    // ...while a different account from that same IP still gets through.
    const bystander = await attempt(app, { email: 'bystander@example.com', ip: '203.0.113.99' });
    expect(bystander.status).toBe(401);
  });
});

describe('login throttling counts failures only', () => {
  // The shared-NAT half of the problem: an office behind one address used to
  // burn the per-IP budget by logging in successfully.
  it('does not spend the per-IP budget on successful logins', async () => {
    const app = buildApp(loadLimiter('loginLimiter', { LOGIN_LIMIT_MAX: '2' }));

    for (let i = 0; i < 6; i += 1) {
      const ok = await attempt(app, { email: 'user@example.com', outcome: 'success' });
      expect(ok.status).toBe(200);
    }

    expect((await attempt(app, { email: 'user@example.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'user@example.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'user@example.com' })).status).toBe(429);
  });

  it('does not spend the per-account budget on successful logins', async () => {
    const app = buildApp(loadLimiter('accountLoginLimiter', { ACCOUNT_LOGIN_LIMIT_MAX: '2' }));

    for (let i = 0; i < 6; i += 1) {
      const ok = await attempt(app, { email: 'user@example.com', outcome: 'success' });
      expect(ok.status).toBe(200);
    }

    expect((await attempt(app, { email: 'user@example.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'user@example.com' })).status).toBe(401);
    expect((await attempt(app, { email: 'user@example.com' })).status).toBe(429);
  });
});

describe('login throttling refusal body', () => {
  // A distinct message would tell an attacker which limiter fired, and the
  // account limiter firing is itself a fact about the account.
  it('is byte-identical between the per-IP and the per-account limiter', async () => {
    const ipApp = buildApp(loadLimiter('loginLimiter', { LOGIN_LIMIT_MAX: '1' }));
    const accountLimiter = loadLimiter('accountLoginLimiter', { ACCOUNT_LOGIN_LIMIT_MAX: '1' });
    const accountApp = buildApp(accountLimiter);

    await attempt(ipApp, { email: 'a@example.com' });
    const ipBlocked = await attempt(ipApp, { email: 'a@example.com' });

    await attempt(accountApp, { email: 'a@example.com' });
    const accountBlocked = await attempt(accountApp, { email: 'a@example.com' });

    expect(ipBlocked.status).toBe(429);
    expect(accountBlocked.status).toBe(429);
    expect(accountBlocked.text).toBe(ipBlocked.text);
    expect(accountBlocked.body).toEqual({ error: TOO_MANY_LOGIN_ATTEMPTS });
  });
});
