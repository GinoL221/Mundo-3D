// Full cookie-jar lifecycle: login -> protected read -> CSRF-guarded write
// -> logout -> the same jar is unauthenticated again. Uses `request.agent()`
// so cookies persist across requests exactly like a real browser, unlike
// apiSecurity.test.js/apiUsersLogin.test.js which hand-build the `Cookie`
// header per request. Mirrors apiSecurity.test.js's "full router mounted,
// use-cases mocked" pattern — chosen over the real-DB
// `migrate.integration.test.js` style because this is an HTTP-contract
// concern (cookies/headers/status codes), not a persistence concern; no
// database interaction is under test here.
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../infrastructure/security/JwtSecret';
import {
  AUTH_COOKIE,
  CSRF_COOKIE,
  USER_COOKIE,
  REFRESH_COOKIE,
  SESSION_MAX_AGE,
  REMEMBER_MAX_AGE,
  ACCESS_TOKEN_TTL_SECONDS,
} from '../infrastructure/security/cookieOptions';

const mockAuthenticateUserExecute = jest.fn();
const mockListUsersExecute = jest.fn();
const mockGetUserByIdExecute = jest.fn();
const mockGetCartByUserIdExecute = jest.fn();
const mockSyncCartExecute = jest.fn();
const mockCreateRememberTokenExecute = jest.fn();
const mockRevokeRefreshTokenExecute = jest.fn();

jest.mock('../application/use-cases/AuthenticateUserUseCase', () => ({
  AuthenticateUserUseCase: jest.fn().mockImplementation(() => ({
    execute: mockAuthenticateUserExecute,
  })),
}));

// PR2: login/register now create a RememberToken and issue a refresh
// cookie; logout revokes its family. Mocked here for the same reason the
// other use cases are — this test is an HTTP-contract test, not a
// persistence test (see the file header comment).
jest.mock('../application/use-cases/CreateRememberTokenUseCase', () => ({
  CreateRememberTokenUseCase: jest.fn().mockImplementation(() => ({
    execute: mockCreateRememberTokenExecute,
  })),
}));

jest.mock('../application/use-cases/RevokeRefreshTokenUseCase', () => ({
  RevokeRefreshTokenUseCase: jest.fn().mockImplementation(() => ({
    execute: mockRevokeRefreshTokenExecute,
  })),
}));

jest.mock('../application/use-cases/ListUsersUseCase', () => ({
  ListUsersUseCase: jest.fn().mockImplementation(() => ({
    execute: mockListUsersExecute,
  })),
}));

jest.mock('../application/use-cases/GetUserByIdUseCase', () => ({
  GetUserByIdUseCase: jest.fn().mockImplementation(() => ({
    execute: mockGetUserByIdExecute,
  })),
}));

jest.mock('../application/use-cases/GetCartByUserIdUseCase', () => ({
  GetCartByUserIdUseCase: jest.fn().mockImplementation(() => ({
    execute: mockGetCartByUserIdExecute,
  })),
}));

jest.mock('../application/use-cases/SyncCartUseCase', () => ({
  SyncCartUseCase: jest.fn().mockImplementation(() => ({
    execute: mockSyncCartExecute,
  })),
}));

const apiRouter = require('../infrastructure/routes/api/index').default;
const errorHandler = require('../infrastructure/middlewares/errorHandler').default;

const JWT_SECRET = getJwtSecret();

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api', apiRouter);
  app.use(errorHandler);
  return app;
}

/** Extracts one cookie's raw value from a supertest `set-cookie` array. */
function cookieValue(setCookie: string[], name: string): string | undefined {
  const header = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!header) return undefined;
  return header.split(';')[0].split('=').slice(1).join('=');
}

/** Extracts one cookie's `Max-Age` attribute (seconds) from a `set-cookie` array. */
function cookieMaxAge(setCookie: string[], name: string): number | undefined {
  const header = setCookie.find((c) => c.startsWith(`${name}=`));
  if (!header) return undefined;
  const match = header.match(/Max-Age=(\d+)/i);
  return match ? parseInt(match[1], 10) : undefined;
}

const AUTHENTICATED_USER = {
  idUser: 5,
  email: 'lifecycle@test.com',
  category: 'User',
  idRole: 2,
  firstName: 'Cookie',
  lastName: 'Tester',
  image: null,
};

describe('Auth cookie lifecycle (login -> protected read -> CSRF write -> logout)', () => {
  let app: express.Express;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateRememberTokenExecute.mockResolvedValue({
      idRememberToken: 1,
      tokenHash: 'irrelevant-hash',
      idUser: AUTHENTICATED_USER.idUser,
      expiryDate: new Date(Date.now() + REMEMBER_MAX_AGE),
      familyId: 'fam-lifecycle-test',
    });
    mockRevokeRefreshTokenExecute.mockResolvedValue(1);
    app = buildApp();
  });

  it('login sets exactly 4 Set-Cookie headers and omits the token from the body', async () => {
    mockAuthenticateUserExecute.mockResolvedValue(AUTHENTICATED_USER);

    const res = await request(app)
      .post('/api/users/login')
      .send({ email: AUTHENTICATED_USER.email, password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ idUser: AUTHENTICATED_USER.idUser });

    const setCookie = res.headers['set-cookie'] as unknown as string[];
    expect(setCookie).toHaveLength(4);
    expect(cookieValue(setCookie, AUTH_COOKIE)).toBeTruthy();
    expect(cookieValue(setCookie, CSRF_COOKIE)).toBeTruthy();
    expect(cookieValue(setCookie, USER_COOKIE)).toBeTruthy();
    expect(cookieValue(setCookie, REFRESH_COOKIE)).toBeTruthy();
  });

  it('walks the full lifecycle: cookie jar authenticates a protected read, a CSRF-guarded write requires the token, and logout revokes the jar', async () => {
    mockAuthenticateUserExecute.mockResolvedValue(AUTHENTICATED_USER);
    mockGetCartByUserIdExecute.mockResolvedValue({ items: [], total: 0 });
    mockSyncCartExecute.mockResolvedValue(undefined);

    const agent = request.agent(app);

    const loginRes = await agent
      .post('/api/users/login')
      .send({ email: AUTHENTICATED_USER.email, password: 'password123' });
    expect(loginRes.status).toBe(200);
    const csrfToken = cookieValue(
      loginRes.headers['set-cookie'] as unknown as string[],
      CSRF_COOKIE
    );
    expect(csrfToken).toBeTruthy();

    // Protected GET succeeds purely from the jar's persisted auth cookie —
    // no manual `Cookie` header construction, unlike apiSecurity.test.js.
    const cartRes = await agent.get('/api/cart');
    expect(cartRes.status).toBe(200);
    expect(mockGetCartByUserIdExecute).toHaveBeenCalledWith(AUTHENTICATED_USER.idUser);

    // A state-changing write without the CSRF header is rejected even
    // though the jar carries a valid auth cookie.
    const writeWithoutCsrf = await agent.put('/api/cart').send({ items: [] });
    expect(writeWithoutCsrf.status).toBe(403);
    expect(mockSyncCartExecute).not.toHaveBeenCalled();

    // The same write succeeds once the CSRF header (read from the m3d_csrf
    // cookie the login response issued) is attached.
    const writeWithCsrf = await agent
      .put('/api/cart')
      .set('X-CSRF-Token', csrfToken as string)
      .send({ items: [{ productId: 1, quantity: 2 }] });
    expect(writeWithCsrf.status).toBe(200);
    expect(mockSyncCartExecute).toHaveBeenCalledWith(AUTHENTICATED_USER.idUser, [
      { productId: 1, quantity: 2 },
    ]);

    // Logout clears all 4 cookies (byte-identical flags per design.md),
    // revokes the refresh family carried in the access JWT, and requires no
    // CSRF header (fail-safe exemption).
    const logoutRes = await agent.post('/api/users/logout');
    expect(logoutRes.status).toBe(204);
    expect(mockRevokeRefreshTokenExecute).toHaveBeenCalledWith('fam-lifecycle-test');
    const clearingCookies = logoutRes.headers['set-cookie'] as unknown as string[];
    expect(clearingCookies).toHaveLength(4);
    [AUTH_COOKIE, CSRF_COOKIE, USER_COOKIE, REFRESH_COOKIE].forEach((name) => {
      const header = clearingCookies.find((c) => c.startsWith(`${name}=`));
      expect(header).toBeTruthy();
      // A cleared cookie carries an empty value and an expiry in the past —
      // superagent's jar removes it, which the next request proves below.
      expect(cookieValue(clearingCookies, name)).toBe('');
    });

    // The jar no longer authenticates: the auth cookie was actually removed,
    // not merely re-sent with the same value.
    const cartAfterLogout = await agent.get('/api/cart');
    expect(cartAfterLogout.status).toBe(401);
  });

  describe('remember-me lifetime', () => {
    // api-jwt-auth spec: "Access token TTL is fixed regardless of remember"
    // — AUTH_COOKIE/its JWT no longer vary with remember; CSRF/USER/REFRESH
    // still do (refresh-token-rotation spec).
    it('remember:true issues a 30-day Max-Age on CSRF/USER/REFRESH, and a fixed-TTL access JWT', async () => {
      mockAuthenticateUserExecute.mockResolvedValue(AUTHENTICATED_USER);

      const res = await request(app)
        .post('/api/users/login')
        .send({ email: AUTHENTICATED_USER.email, password: 'password123', remember: true });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const expectedMaxAgeSeconds = REMEMBER_MAX_AGE / 1000;

      [CSRF_COOKIE, USER_COOKIE, REFRESH_COOKIE].forEach((name) => {
        expect(cookieMaxAge(setCookie, name)).toBe(expectedMaxAgeSeconds);
      });
      expect(cookieMaxAge(setCookie, AUTH_COOKIE)).toBe(ACCESS_TOKEN_TTL_SECONDS);

      const authToken = cookieValue(setCookie, AUTH_COOKIE) as string;
      const decoded = jwt.verify(authToken, JWT_SECRET) as jwt.JwtPayload;
      expect((decoded.exp as number) - (decoded.iat as number)).toBe(ACCESS_TOKEN_TTL_SECONDS);
      expect(decoded.typ).toBe('access');
    });

    it('leaving remember unchecked keeps the default 2h Max-Age on CSRF/USER/REFRESH, and the same fixed-TTL access JWT', async () => {
      mockAuthenticateUserExecute.mockResolvedValue(AUTHENTICATED_USER);

      const res = await request(app)
        .post('/api/users/login')
        .send({ email: AUTHENTICATED_USER.email, password: 'password123' });

      expect(res.status).toBe(200);
      const setCookie = res.headers['set-cookie'] as unknown as string[];
      const expectedMaxAgeSeconds = SESSION_MAX_AGE / 1000;

      [CSRF_COOKIE, USER_COOKIE, REFRESH_COOKIE].forEach((name) => {
        expect(cookieMaxAge(setCookie, name)).toBe(expectedMaxAgeSeconds);
      });
      expect(cookieMaxAge(setCookie, AUTH_COOKIE)).toBe(ACCESS_TOKEN_TTL_SECONDS);

      const authToken = cookieValue(setCookie, AUTH_COOKIE) as string;
      const decoded = jwt.verify(authToken, JWT_SECRET) as jwt.JwtPayload;
      expect((decoded.exp as number) - (decoded.iat as number)).toBe(ACCESS_TOKEN_TTL_SECONDS);
    });
  });
});
