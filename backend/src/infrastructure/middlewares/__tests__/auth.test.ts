import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { apiAuthMiddleware, adminGuard, requireRoles } from '../auth';
import { getJwtSecret } from '../../security/JwtSecret';
import { AUTH_COOKIE } from '../../security/cookieOptions';
import { accessTokenSignOptions } from '../../security/jwtOptions';
import { Role } from '../../../domain/Role';

jest.mock('../../security/JwtSecret', () => ({
  getJwtSecret: jest.fn(() => 'test-only-jwt-secret-not-for-production'),
}));

const JWT_SECRET = getJwtSecret();

describe('apiAuthMiddleware', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { headers: {}, cookies: {} };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('returns 401 JSON error when no auth cookie is present', () => {
    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 JSON error when the auth cookie value is empty', () => {
    req.cookies = { [AUTH_COOKIE]: '' };
    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación no proporcionado' });
  });

  // This is the property that makes a session-length `m3d_auth` cookie safe.
  // The cookie deliberately outlives its token so `logout` can read
  // `familyId` from an expired one — acceptable only while that expired token
  // authenticates nothing. Nothing asserted it before: the test below is
  // named "invalid or expired" but passes a malformed string, which never
  // reaches `jwt.verify`'s expiry branch at all.
  it('returns 401 for a correctly signed token whose exp has passed', () => {
    const expired = jwt.sign(
      { userId: 1, email: 'user@test.com', category: 'User', idRole: 2, typ: 'access' },
      JWT_SECRET,
      accessTokenSignOptions(-60)
    );
    req.cookies = { [AUTH_COOKIE]: expired };

    apiAuthMiddleware(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación inválido o expirado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 JSON error when the auth cookie holds a malformed token', () => {
    req.cookies = { [AUTH_COOKIE]: 'invalid-token-value' };
    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación inválido o expirado' });
  });

  it('attaches payload to req.user and calls next() on a valid auth cookie carrying typ: "access"', () => {
    const payload = { userId: 1, email: 'user@test.com', category: 'User', idRole: 2, typ: 'access' };
    const token = jwt.sign(payload, JWT_SECRET, accessTokenSignOptions('2h'));
    req.cookies = { [AUTH_COOKIE]: token };

    apiAuthMiddleware(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toMatchObject(payload);
  });

  // api-jwt-auth spec: "Pre-deploy JWT without typ claim is rejected" — a
  // validly-signed, unexpired JWT minted before this change carries no `typ`
  // at all. Forced logout at deploy must be deterministic, not hoped-for
  // (design.md D3).
  it('returns 401 when a validly-signed, unexpired token has no typ claim (pre-deploy JWT)', () => {
    const payload = { userId: 1, email: 'user@test.com', category: 'User', idRole: 2 };
    const token = jwt.sign(payload, JWT_SECRET, accessTokenSignOptions('2h'));
    req.cookies = { [AUTH_COOKIE]: token };

    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when typ carries a value other than "access" (e.g. a refresh-typed token confused for access)', () => {
    const payload = { userId: 1, email: 'user@test.com', category: 'User', idRole: 2, typ: 'refresh' };
    const token = jwt.sign(payload, JWT_SECRET, accessTokenSignOptions('2h'));
    req.cookies = { [AUTH_COOKIE]: token };

    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // Findings 5+6. A claim that nothing verifies is worth nothing, so these
  // assert the VERIFIER, not the signer: each token below is signed with this
  // API's own secret — the only thing wrong with it is a claim, and the claim
  // alone must be enough to reject it.
  describe('registered-claim and algorithm pinning', () => {
    const payload = { userId: 1, email: 'user@test.com', category: 'User', idRole: 2, typ: 'access' };

    // The pre-deploy-token case: every access token minted before this change
    // carries no `iss`/`aud` at all. Without this assertion, verification
    // could silently accept them and the pinning would be decorative.
    it('returns 401 for a validly signed token carrying no issuer and no audience', () => {
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
      req.cookies = { [AUTH_COOKIE]: token };

      apiAuthMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación inválido o expirado' });
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for a token minted for a different audience', () => {
      const token = jwt.sign(payload, JWT_SECRET, {
        ...accessTokenSignOptions('2h'),
        audience: 'some-other-api',
      });
      req.cookies = { [AUTH_COOKIE]: token };

      apiAuthMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for a token minted by a different issuer', () => {
      const token = jwt.sign(payload, JWT_SECRET, {
        ...accessTokenSignOptions('2h'),
        issuer: 'some-other-issuer',
      });
      req.cookies = { [AUTH_COOKIE]: token };

      apiAuthMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    // Verification must name the algorithms it accepts. Left open, the token
    // itself gets to choose, and `alg` becomes attacker-controlled input.
    it('returns 401 for a token advertising an algorithm other than HS256', () => {
      const token = jwt.sign(payload, JWT_SECRET, {
        ...accessTokenSignOptions('2h'),
        algorithm: 'HS512',
      });
      req.cookies = { [AUTH_COOKIE]: token };

      apiAuthMiddleware(req as Request, res as Response, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  it('returns 401 when a valid JWT is sent only as an Authorization: Bearer header (no cookie)', () => {
    const payload = { userId: 1, email: 'user@test.com', category: 'User', idRole: 2 };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '2h' });
    req.headers!.authorization = `Bearer ${token}`;

    apiAuthMiddleware(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticación no proporcionado' });
    expect(next).not.toHaveBeenCalled();
  });
});

describe('requireRoles', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: '/api/products' };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('returns 401 JSON error when there is no principal (no req.user)', () => {
    const guard = requireRoles(Role.ADMIN, Role.STAFF);
    guard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Autenticación requerida' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON error when the authenticated role is not in the allow-list', () => {
    req.user = { userId: 2, email: 'user@test.com', category: 'User', idRole: Role.USER };
    const guard = requireRoles(Role.ADMIN, Role.STAFF);
    guard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso restringido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the authenticated role is in the allow-list', () => {
    req.user = { userId: 3, email: 'staff@test.com', category: 'Staff', idRole: Role.STAFF };
    const guard = requireRoles(Role.ADMIN, Role.STAFF);
    guard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a single-role allow-list when the role does not match', () => {
    req.user = { userId: 3, email: 'staff@test.com', category: 'Staff', idRole: Role.STAFF };
    const guard = requireRoles(Role.ADMIN);
    guard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('adminGuard (alias for requireRoles(Role.ADMIN))', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { path: '/api/users' };
    res = {
      status: jest.fn().mockReturnThis() as any,
      json: jest.fn().mockReturnThis() as any
    };
    next = jest.fn();
  });

  it('returns 401 JSON error for non-authenticated requests', () => {
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Autenticación requerida' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON error for authenticated requests if role is not admin', () => {
    req.user = { userId: 2, email: 'user@test.com', category: 'User', idRole: Role.USER };
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acceso restringido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 JSON error for authenticated STAFF requests (admin-only route)', () => {
    req.user = { userId: 3, email: 'staff@test.com', category: 'Staff', idRole: Role.STAFF };
    adminGuard(req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for admin requests (Role.ADMIN)', () => {
    req.user = { userId: 1, email: 'admin@test.com', category: 'Admin', idRole: Role.ADMIN };
    adminGuard(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});
