import type { Algorithm, SignOptions, VerifyOptions } from 'jsonwebtoken';

/**
 * Single shared source of the access token's algorithm and registered
 * claims, in the same spirit as `cookieOptions.ts` for cookie flags.
 *
 * There is exactly one place that signs an access token
 * (`sessionCookies.issueAccessCookie`) and two that verify one
 * (`apiAuthMiddleware`, `sessionCookies.readFamilyIdFromAccessToken`), and
 * the three only ever fail together. A claim the signer adds but no verifier
 * checks is decorative; a claim a verifier requires but nobody signs locks
 * every user out. Neither can happen while all three read these constants.
 */

/**
 * Pinned on BOTH sides. Verification that does not name its algorithms lets
 * the token's own `alg` header decide how it is checked, which makes an
 * attacker-supplied field part of the trust decision.
 */
export const JWT_ALGORITHM: Algorithm = 'HS256';

/** `iss` — who minted the token. */
export const JWT_ISSUER = 'mundo-3d';

/**
 * `aud` — who it is for. Scopes the token to this API, so a token minted for
 * any other consumer of the same secret is not silently accepted here.
 */
export const JWT_AUDIENCE = 'mundo-3d-api';

/**
 * Sign options for an access token. `expiresIn` stays a parameter because it
 * is the one value that legitimately varies (production passes
 * `ACCESS_TOKEN_TTL_SECONDS`, the no-deploy rollback lever).
 */
export const accessTokenSignOptions = (expiresIn: SignOptions['expiresIn']): SignOptions => ({
  algorithm: JWT_ALGORITHM,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  expiresIn,
});

/**
 * Verify options for an access token. `overrides` exists for exactly one
 * caller — `readFamilyIdFromAccessToken` passes `ignoreExpiration: true`,
 * which relaxes `exp` and nothing else: signature, algorithm, issuer and
 * audience are all still enforced.
 */
export const accessTokenVerifyOptions = (overrides: VerifyOptions = {}): VerifyOptions => ({
  algorithms: [JWT_ALGORITHM],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  ...overrides,
});
