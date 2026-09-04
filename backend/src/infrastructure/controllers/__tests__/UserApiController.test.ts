import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserApiController } from '../UserApiController';
import { AuthenticateUserUseCase } from '../../../application/use-cases/AuthenticateUserUseCase';
import { ListUsersUseCase } from '../../../application/use-cases/ListUsersUseCase';
import { GetUserByIdUseCase } from '../../../application/use-cases/GetUserByIdUseCase';
import { RegisterUserUseCase } from '../../../application/use-cases/RegisterUserUseCase';
import { CreateRememberTokenUseCase } from '../../../application/use-cases/CreateRememberTokenUseCase';
import { RefreshSessionUseCase } from '../../../application/use-cases/RefreshSessionUseCase';
import { RevokeRefreshTokenUseCase } from '../../../application/use-cases/RevokeRefreshTokenUseCase';
import { InvalidCredentialsException } from '../../../domain/exceptions/InvalidCredentialsException';
import { UserAlreadyExistsException } from '../../../domain/exceptions/UserAlreadyExistsException';
import { cleanupUploadedFile } from '../../utils/cleanupUploadedFile';
import { getJwtSecret } from '../../security/JwtSecret';
import { accessTokenSignOptions } from '../../security/jwtOptions';
import {
  AUTH_COOKIE,
  CSRF_COOKIE,
  USER_COOKIE,
  REFRESH_COOKIE,
  SESSION_MAX_AGE,
  REMEMBER_MAX_AGE,
  ACCESS_TOKEN_TTL_SECONDS,
} from '../../security/cookieOptions';

jest.mock('../../utils/cleanupUploadedFile', () => ({
  cleanupUploadedFile: jest.fn(),
}));

describe('UserApiController', () => {
  let controller: UserApiController;
  let mockAuthenticateUserUseCase: jest.Mocked<AuthenticateUserUseCase>;
  let mockListUsersUseCase: jest.Mocked<ListUsersUseCase>;
  let mockGetUserByIdUseCase: jest.Mocked<GetUserByIdUseCase>;
  let mockRegisterUserUseCase: jest.Mocked<RegisterUserUseCase>;
  let mockCreateRememberTokenUseCase: jest.Mocked<CreateRememberTokenUseCase>;
  let mockRefreshSessionUseCase: jest.Mocked<RefreshSessionUseCase>;
  let mockRevokeRefreshTokenUseCase: jest.Mocked<RevokeRefreshTokenUseCase>;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    mockAuthenticateUserUseCase = {
      execute: jest.fn(),
    } as any;
    mockListUsersUseCase = {
      execute: jest.fn(),
    } as any;
    mockGetUserByIdUseCase = {
      execute: jest.fn(),
    } as any;
    mockRegisterUserUseCase = {
      execute: jest.fn(),
    } as any;
    mockCreateRememberTokenUseCase = {
      execute: jest.fn().mockResolvedValue({
        idRememberToken: 1,
        tokenHash: 'hashed',
        idUser: 1,
        expiryDate: new Date(Date.now() + SESSION_MAX_AGE),
        familyId: 'fam-test',
      }),
    } as any;
    mockRefreshSessionUseCase = {
      execute: jest.fn(),
    } as any;
    mockRevokeRefreshTokenUseCase = {
      execute: jest.fn().mockResolvedValue(1),
    } as any;

    controller = new UserApiController(
      mockAuthenticateUserUseCase,
      mockListUsersUseCase,
      mockGetUserByIdUseCase,
      mockRegisterUserUseCase,
      mockCreateRememberTokenUseCase,
      mockRefreshSessionUseCase,
      mockRevokeRefreshTokenUseCase
    );

    req = {
      body: {},
      params: {},
      cookies: {},
    };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any,
      cookie: jest.fn().mockReturnThis() as any,
      clearCookie: jest.fn().mockReturnThis() as any,
      sendStatus: jest.fn().mockReturnThis() as any,
    };
    next = jest.fn();

    (cleanupUploadedFile as jest.Mock).mockClear();
  });

  describe('register', () => {
    it('sets the 4 session cookies and does NOT include a token in the JSON body', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };
      req.file = {
        key: 'users/uuid-1.png',
        location: 'https://pub-test.r2.dev/users/uuid-1.png',
      } as any;

      const mockUserDto = {
        idUser: 123,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        image: 'https://pub-test.r2.dev/users/uuid-1.png',
        idRole: 2,
        category: 'User',
      };

      mockRegisterUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).register(req as Request, res as Response, next);

      expect(mockRegisterUserUseCase.execute).toHaveBeenCalledWith({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
        image: 'https://pub-test.r2.dev/users/uuid-1.png',
      });
      expect(res.status).toHaveBeenCalledWith(201);

      const cookieNames = (res.cookie as jest.Mock).mock.calls.map((call) => call[0]);
      expect(cookieNames).toEqual(
        expect.arrayContaining([AUTH_COOKIE, CSRF_COOKIE, USER_COOKIE, REFRESH_COOKIE])
      );

      const authCookieCall = (res.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === AUTH_COOKIE
      );
      expect(authCookieCall[2]).toMatchObject({ httpOnly: true, maxAge: SESSION_MAX_AGE });

      expect(mockCreateRememberTokenUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ idUser: 123, durationSeconds: SESSION_MAX_AGE / 1000 })
      );

      expect(res.json).toHaveBeenCalledWith(
        expect.not.objectContaining({ token: expect.anything() })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 if user email is already registered and removes the orphaned upload', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };
      req.file = {
        key: 'users/uuid-1.png',
        location: 'https://pub-test.r2.dev/users/uuid-1.png',
      } as any;

      mockRegisterUserUseCase.execute.mockRejectedValue(
        new UserAlreadyExistsException('Este email ya está registrado')
      );

      await (controller as any).register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Este email ya está registrado',
      });
      expect(cleanupUploadedFile).toHaveBeenCalledWith('users/uuid-1.png');
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 400 if req.file is missing', async () => {
      req.body = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'password123',
      };

      await (controller as any).register(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Tienes que subir una imagen',
      });
      expect(mockRegisterUserUseCase.execute).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    const mockUserDto = {
      idUser: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      image: 'avatar.png',
      idRole: 2,
      category: 'User',
    };

    it('sets 4 Set-Cookie-equivalent res.cookie calls and does NOT include a token in the body', async () => {
      req.body = { email: 'john@example.com', password: 'password123' };
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).login(req as Request, res as Response, next);

      const cookieNames = (res.cookie as jest.Mock).mock.calls.map((call) => call[0]);
      expect(cookieNames).toEqual(
        expect.arrayContaining([AUTH_COOKIE, CSRF_COOKIE, USER_COOKIE, REFRESH_COOKIE])
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.not.objectContaining({ token: expect.anything() })
      );
      expect(next).not.toHaveBeenCalled();
    });

    // Task 2.16 (no dedicated RED pair in tasks.md — written here per strict
    // TDD before the GREEN implementation; see apply-progress deviation #1).
    it('creates a RememberToken via CreateRememberTokenUseCase and issues the refresh cookie, embedding familyId in the access JWT', async () => {
      req.body = { email: 'john@example.com', password: 'password123', remember: true };
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);
      mockCreateRememberTokenUseCase.execute.mockResolvedValue({
        idRememberToken: 9,
        tokenHash: 'irrelevant-hash',
        idUser: 1,
        expiryDate: new Date(Date.now() + REMEMBER_MAX_AGE),
        familyId: 'fam-login-1',
      });

      await (controller as any).login(req as Request, res as Response, next);

      expect(mockCreateRememberTokenUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ idUser: 1, durationSeconds: REMEMBER_MAX_AGE / 1000 })
      );

      const refreshCookieCall = (res.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === REFRESH_COOKIE
      );
      expect(refreshCookieCall).toBeDefined();
      expect(refreshCookieCall[2]).toMatchObject({ httpOnly: true, maxAge: REMEMBER_MAX_AGE });
      // The plaintext refresh token must NOT equal the hash CreateRememberTokenUseCase stored.
      expect(refreshCookieCall[1]).not.toBe('irrelevant-hash');

      const authCookieCall = (res.cookie as jest.Mock).mock.calls.find(
        (call) => call[0] === AUTH_COOKIE
      );
      const decoded = jwt.verify(authCookieCall[1] as string, getJwtSecret()) as jwt.JwtPayload;
      expect(decoded.familyId).toBe('fam-login-1');
    });

    // api-jwt-auth spec: "Access token TTL is fixed regardless of remember" —
    // remember now extends the CSRF/display cookies (and, per PR2's own
    // refresh-token-rotation spec, the refresh cookie), NOT the access token.
    it('issues an access cookie on the session lifetime carrying a fixed-TTL JWT, remember true or false', async () => {
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      for (const remember of [true, false, undefined]) {
        (res.cookie as jest.Mock).mockClear();
        req.body = { email: 'john@example.com', password: 'password123', remember };

        await (controller as any).login(req as Request, res as Response, next);

        const authCookieCall = (res.cookie as jest.Mock).mock.calls.find(
          (call) => call[0] === AUTH_COOKIE
        );
        // The COOKIE follows the session so logout can still read `familyId`
        // from it later; the TOKEN below is what stays fixed at 30 minutes.
        expect(authCookieCall[2].maxAge).toBe(remember ? REMEMBER_MAX_AGE : SESSION_MAX_AGE);

        const token = authCookieCall[1] as string;
        const decoded = jwt.verify(token, getJwtSecret()) as jwt.JwtPayload;
        const secondsRemaining = (decoded.exp as number) - (decoded.iat as number);
        expect(secondsRemaining).toBe(ACCESS_TOKEN_TTL_SECONDS);
        expect(decoded.typ).toBe('access');
      }
    });

    it('issues a 30-day CSRF/display cookie maxAge when remember is true, 2h when omitted', async () => {
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      req.body = { email: 'john@example.com', password: 'password123', remember: true };
      await (controller as any).login(req as Request, res as Response, next);
      let csrfCookieCall = (res.cookie as jest.Mock).mock.calls.find((call) => call[0] === CSRF_COOKIE);
      expect(csrfCookieCall[2]).toMatchObject({ maxAge: REMEMBER_MAX_AGE });

      (res.cookie as jest.Mock).mockClear();
      req.body = { email: 'john@example.com', password: 'password123' };
      await (controller as any).login(req as Request, res as Response, next);
      csrfCookieCall = (res.cookie as jest.Mock).mock.calls.find((call) => call[0] === CSRF_COOKIE);
      expect(csrfCookieCall[2]).toMatchObject({ maxAge: SESSION_MAX_AGE });
    });

    it('returns 401 and sets no cookies on invalid credentials', async () => {
      req.body = { email: 'john@example.com', password: 'wrong' };
      mockAuthenticateUserUseCase.execute.mockRejectedValue(
        new InvalidCredentialsException('El email o la contraseña no coinciden')
      );

      await (controller as any).login(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    // Characterization test (task 2.1), superseded by task 2.4 exactly as
    // flagged when it was written: on `main`, all 3 cookies shared one
    // maxAge. CSRF/USER share one
    // maxAge (the remember-derived session length), and AUTH_COOKIE now
    // shares it too: logout must read `familyId` from an expired token.
    it('characterization: all four cookies now share one maxAge; only the TOKEN inside AUTH is short-lived', async () => {
      req.body = { email: 'john@example.com', password: 'password123' };
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).login(req as Request, res as Response, next);

      const calls = (res.cookie as jest.Mock).mock.calls;
      expect(calls).toHaveLength(4); // AUTH, CSRF, USER, REFRESH (task 2.16)
      // AUTH used to diverge here. It no longer does: the cookie must outlive
      // its own token so `logout` can read `familyId` from an expired one and
      // revoke the refresh family. `apiAuthMiddleware` still rejects the
      // stale token on `exp`, so the longer cookie authenticates nothing.
      expect(new Set(calls.map((call) => call[2].maxAge)).size).toBe(1);
      const authCookieCall = calls.find((call) => call[0] === AUTH_COOKIE);
      expect(authCookieCall[2].maxAge).toBe(SESSION_MAX_AGE);
    });

    it('characterization: CSRF and USER cookies are httpOnly:false, AUTH is httpOnly:true', async () => {
      req.body = { email: 'john@example.com', password: 'password123' };
      mockAuthenticateUserUseCase.execute.mockResolvedValue(mockUserDto);

      await (controller as any).login(req as Request, res as Response, next);

      const byName = (name: string) =>
        (res.cookie as jest.Mock).mock.calls.find((call) => call[0] === name)[2];
      expect(byName(AUTH_COOKIE).httpOnly).toBe(true);
      expect(byName(CSRF_COOKIE).httpOnly).toBe(false);
      expect(byName(USER_COOKIE).httpOnly).toBe(false);
    });
  });

  // Regression: `issueAccessCookie` was called here without the third
  // argument, so every refresh rewrote `m3d_auth` with the 2h default —
  // silently downgrading a 30-day remembered session on its FIRST refresh.
  // Two idle hours later the cookie was gone, `logout` could read no
  // `familyId`, and revocation was skipped: HIGH-1 back on a 2h trigger.
  // The cookie now tracks the family's own remaining lifetime.
  describe('refresh — access cookie lifetime', () => {
    it('gives the access cookie the refresh family\'s remaining lifetime, not the 2h default', async () => {
      const thirtyDaysOut = new Date(Date.now() + REMEMBER_MAX_AGE);
      mockRefreshSessionUseCase.execute.mockResolvedValue({
        outcome: 'grace',
        user: { idUser: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', image: null, idRole: 2, category: 'User' },
        familyId: 'fam-remembered',
        familyExpiresAt: thirtyDaysOut,
      });
      req.cookies = { m3d_refresh: 'presented-token' };

      await (controller as any).refresh(req as Request, res as Response, next);

      const authCall = (res.cookie as jest.Mock).mock.calls.find((c) => c[0] === AUTH_COOKIE);
      expect(authCall).toBeDefined();
      // Within a minute of 30 days — not the 2h SESSION_MAX_AGE default.
      expect(authCall[2].maxAge).toBeGreaterThan(REMEMBER_MAX_AGE - 60_000);
      expect(authCall[2].maxAge).not.toBe(SESSION_MAX_AGE);
    });
  });

  describe('logout', () => {
    it('clears all 4 session cookies with byte-identical flags to login and responds 204', async () => {
      const payload = { userId: 1, email: 'john@example.com', category: 'User', idRole: 2, familyId: 'fam-1', typ: 'access' };
      req.cookies = { [AUTH_COOKIE]: jwt.sign(payload, getJwtSecret(), accessTokenSignOptions('30m')) };

      await (controller as any).logout(req as Request, res as Response, next);

      const clearedNames = (res.clearCookie as jest.Mock).mock.calls.map((call) => call[0]);
      expect(clearedNames).toEqual(
        expect.arrayContaining([AUTH_COOKIE, CSRF_COOKIE, USER_COOKIE, REFRESH_COOKIE])
      );
      expect((res.clearCookie as jest.Mock).mock.calls).toHaveLength(4);

      const authClearOptions = (res.clearCookie as jest.Mock).mock.calls.find(
        (call) => call[0] === AUTH_COOKIE
      )[1];
      expect(authClearOptions).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/' });

      expect(res.sendStatus).toHaveBeenCalledWith(204);
      expect(next).not.toHaveBeenCalled();
    });

    // api-jwt-auth spec: "Logout revokes the refresh family".
    it('revokes the refresh token family carried in the access JWT (familyId claim)', async () => {
      const payload = { userId: 1, email: 'john@example.com', category: 'User', idRole: 2, familyId: 'fam-42', typ: 'access' };
      req.cookies = { [AUTH_COOKIE]: jwt.sign(payload, getJwtSecret(), accessTokenSignOptions('30m')) };

      await (controller as any).logout(req as Request, res as Response, next);

      expect(mockRevokeRefreshTokenUseCase.execute).toHaveBeenCalledWith('fam-42');
      expect(res.sendStatus).toHaveBeenCalledWith(204);
    });

    // api-jwt-auth spec: "Logout without an active session" — MUST NOT error.
    it('still clears cookies and responds 204 with no auth cookie, without revoking anything', async () => {
      req.cookies = {};

      await (controller as any).logout(req as Request, res as Response, next);

      expect(mockRevokeRefreshTokenUseCase.execute).not.toHaveBeenCalled();
      expect(res.sendStatus).toHaveBeenCalledWith(204);
      expect(next).not.toHaveBeenCalled();
    });

    // An EXPIRED but validly signed token still proves which family this
    // session belongs to — the signature is what matters here, not `exp`.
    // This is the common case: the access cookie outlives its 30-minute
    // token, so a user who steps away and logs out later must still revoke.
    it('revokes the family from a validly signed but EXPIRED access token', async () => {
      const expired = jwt.sign(
        { userId: 1, email: 'a@b.c', familyId: 'fam-expired' },
        getJwtSecret(),
        accessTokenSignOptions(-60)
      );
      req.cookies = { [AUTH_COOKIE]: expired };

      await (controller as any).logout(req as Request, res as Response, next);

      expect(mockRevokeRefreshTokenUseCase.execute).toHaveBeenCalledWith('fam-expired');
      expect(res.sendStatus).toHaveBeenCalledWith(204);
    });

    it('still succeeds (204, no revoke) when the auth cookie is unsigned garbage — never trusts unverified data', async () => {
      req.cookies = { [AUTH_COOKIE]: 'not-a-valid-jwt' };

      await (controller as any).logout(req as Request, res as Response, next);

      expect(mockRevokeRefreshTokenUseCase.execute).not.toHaveBeenCalled();
      expect(res.sendStatus).toHaveBeenCalledWith(204);
    });

    // Found during apply: a genuine infrastructure failure while revoking
    // (e.g. a DB error) must surface via next(error), not be silently
    // swallowed by the same catch that tolerates an expired/invalid JWT —
    // otherwise logout would report success (204) while the family was
    // never actually revoked.
    it('propagates a real revocation failure via next(), unlike a jwt.verify failure', async () => {
      const payload = { userId: 1, email: 'john@example.com', category: 'User', idRole: 2, familyId: 'fam-1', typ: 'access' };
      req.cookies = { [AUTH_COOKIE]: jwt.sign(payload, getJwtSecret(), accessTokenSignOptions('30m')) };
      mockRevokeRefreshTokenUseCase.execute.mockRejectedValue(new Error('DB unavailable'));

      await (controller as any).logout(req as Request, res as Response, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.sendStatus).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    it('200s with a fresh access cookie when the refresh use case reports a rotation', async () => {
      req.cookies = { [REFRESH_COOKIE]: 'presented-plain-token' };
      mockRefreshSessionUseCase.execute.mockResolvedValue({
        outcome: 'rotated',
        user: { idUser: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', image: null, idRole: 2, category: 'User' },
        familyId: 'fam-1',
        familyExpiresAt: new Date(Date.now() + SESSION_MAX_AGE),
        refreshToken: { expiryDate: new Date(Date.now() + SESSION_MAX_AGE) } as any,
      });

      await (controller as any).refresh(req as Request, res as Response, next);

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ user: expect.objectContaining({ idUser: 1 }) }));
      const authCookieCall = (res.cookie as jest.Mock).mock.calls.find((call) => call[0] === AUTH_COOKIE);
      expect(authCookieCall).toBeDefined();
      const refreshCookieCall = (res.cookie as jest.Mock).mock.calls.find((call) => call[0] === REFRESH_COOKIE);
      expect(refreshCookieCall).toBeDefined(); // refresh cookie IS set on rotation
      expect(next).not.toHaveBeenCalled();
    });

    it('200s with a fresh access cookie but NO refresh cookie on a grace hit', async () => {
      req.cookies = { [REFRESH_COOKIE]: 'presented-plain-token' };
      mockRefreshSessionUseCase.execute.mockResolvedValue({
        outcome: 'grace',
        user: { idUser: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', image: null, idRole: 2, category: 'User' },
        familyId: 'fam-1',
        familyExpiresAt: new Date(Date.now() + SESSION_MAX_AGE),
      });

      await (controller as any).refresh(req as Request, res as Response, next);

      const authCookieCall = (res.cookie as jest.Mock).mock.calls.find((call) => call[0] === AUTH_COOKIE);
      expect(authCookieCall).toBeDefined();
      const refreshCookieCall = (res.cookie as jest.Mock).mock.calls.find((call) => call[0] === REFRESH_COOKIE);
      expect(refreshCookieCall).toBeUndefined(); // correctness requirement (design.md D2), not an optimization
    });

    it('401s when the refresh cookie is absent', async () => {
      req.cookies = {};

      await (controller as any).refresh(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockRefreshSessionUseCase.execute).not.toHaveBeenCalled();
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('401s when the use case rejects (expired/revoked/replayed)', async () => {
      req.cookies = { [REFRESH_COOKIE]: 'stale-token' };
      mockRefreshSessionUseCase.execute.mockResolvedValue({ outcome: 'rejected' });

      await (controller as any).refresh(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    // refresh-token-reuse-detection design.md D2/D3: the reuse response must
    // be indistinguishable from an ordinary rejection at the HTTP boundary.
    it('401s with the same body and no Set-Cookie when the use case reports reuse-detected, identical to a rejection', async () => {
      req.cookies = { [REFRESH_COOKIE]: 'replayed-token' };
      mockRefreshSessionUseCase.execute.mockResolvedValue({ outcome: 'reuse-detected' });

      await (controller as any).refresh(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Sesión expirada' });
      expect(res.cookie).not.toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });
  });
});
