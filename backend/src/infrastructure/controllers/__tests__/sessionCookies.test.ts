import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { issueAccessCookie, readFamilyIdFromAccessToken, JwtPayload } from '../sessionCookies';
import { apiAuthMiddleware } from '../../middlewares/auth';
import { getJwtSecret } from '../../security/JwtSecret';
import { AUTH_COOKIE, SESSION_MAX_AGE } from '../../security/cookieOptions';
import {
  accessTokenSignOptions,
  JWT_ALGORITHM,
  JWT_AUDIENCE,
  JWT_ISSUER,
} from '../../security/jwtOptions';

const basePayload: JwtPayload = {
  userId: 1,
  email: 'user@test.com',
  category: 'User',
  idRole: 2,
  familyId: 'fam-1',
};

/** Runs the one real sign path and hands back the token it put in the cookie. */
const issueToken = (payload: JwtPayload = basePayload): string => {
  const cookie = jest.fn();
  issueAccessCookie({ cookie } as unknown as Response, payload, SESSION_MAX_AGE);
  return cookie.mock.calls[0][1] as string;
};

describe('issueAccessCookie', () => {
  // Findings 5+6. The signer and the two verifiers read the same module, so
  // this asserts the claims actually land on the wire — a verifier pinning
  // claims nobody signs would lock every user out.
  it('signs the access token with the shared issuer, audience and algorithm', () => {
    const token = issueToken();

    const decoded = jwt.decode(token, { complete: true });

    expect(decoded?.header.alg).toBe(JWT_ALGORITHM);
    expect((decoded?.payload as jwt.JwtPayload).iss).toBe(JWT_ISSUER);
    expect((decoded?.payload as jwt.JwtPayload).aud).toBe(JWT_AUDIENCE);
  });

  // The round trip is the property that matters: whatever the signer puts on
  // the token, the middleware must still accept it. Signer and verifier can
  // only drift apart here, and this is where that shows up.
  it('issues a token that apiAuthMiddleware accepts', () => {
    const req = { cookies: { [AUTH_COOKIE]: issueToken() } } as unknown as Request;
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() } as unknown as Response;
    const next = jest.fn() as NextFunction;

    apiAuthMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(req.user).toMatchObject({ userId: 1, typ: 'access' });
  });
});

describe('readFamilyIdFromAccessToken', () => {
  it('returns the familyId carried by a freshly issued access token', () => {
    expect(readFamilyIdFromAccessToken(issueToken())).toBe('fam-1');
  });

  // Logout's only route to revocation. The access cookie deliberately
  // outlives its 30-minute token, so by the time a user who stepped away
  // logs out, this is the COMMON case — not an edge one. If claim pinning
  // ever broke it, the refresh family would silently survive logout for up
  // to 30 days and the session would outlive the logout that ended it.
  it('still returns the familyId from an EXPIRED but otherwise valid token', () => {
    const expired = jwt.sign(
      { ...basePayload, familyId: 'fam-expired', typ: 'access' },
      getJwtSecret(),
      accessTokenSignOptions(-60)
    );

    expect(readFamilyIdFromAccessToken(expired)).toBe('fam-expired');
  });

  // `ignoreExpiration` relaxes `exp` and nothing else: every other check,
  // including the pinned claims, still has to pass.
  it('returns undefined for a token minted for a different audience', () => {
    const foreign = jwt.sign({ ...basePayload, typ: 'access' }, getJwtSecret(), {
      ...accessTokenSignOptions('30m'),
      audience: 'some-other-api',
    });

    expect(readFamilyIdFromAccessToken(foreign)).toBeUndefined();
  });

  // Characterises the deploy window rather than asking for it. A token
  // minted before this change carries no `iss`/`aud`, so logout cannot read
  // its familyId and that refresh family survives until its own expiry
  // (up to 30 days) instead of being revoked. The user IS logged out — all
  // four cookies are cleared and the refresh plaintext leaves the browser —
  // so this only matters for a refresh token already exfiltrated before the
  // deploy. Pinned here so the trade-off is visible instead of discovered.
  it('returns undefined for a pre-deploy token carrying no issuer or audience', () => {
    const preDeploy = jwt.sign({ ...basePayload, typ: 'access' }, getJwtSecret(), {
      expiresIn: '30m',
    });

    expect(readFamilyIdFromAccessToken(preDeploy)).toBeUndefined();
  });

  it('returns undefined for a token signed with a foreign secret', () => {
    const forged = jwt.sign(
      { ...basePayload, typ: 'access' },
      'a-different-secret-that-is-long-enough',
      accessTokenSignOptions('30m')
    );

    expect(readFamilyIdFromAccessToken(forged)).toBeUndefined();
  });

  it('returns undefined for a value that is not a token at all', () => {
    expect(readFamilyIdFromAccessToken('not-a-jwt')).toBeUndefined();
  });
});
