import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { getJwtSecret } from '../security/JwtSecret';
import { AUTH_COOKIE } from '../security/cookieOptions';
import { accessTokenVerifyOptions } from '../security/jwtOptions';
import { Role } from '../../domain/Role';
import { hasValidCsrfForUser } from './csrf';

interface DecodedToken {
  userId: number;
  email?: string;
  category?: string;
  idRole?: number;
  typ?: string;
}

export const apiAuthMiddleware = (req: Request, res: Response, next: NextFunction): void | Response => {
  const token = req.cookies?.[AUTH_COOKIE];

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
  }

  try {
    // Algorithm, issuer and audience come from `jwtOptions` — the same module
    // the one sign site reads — so a claim can never be signed here and left
    // unchecked there, or required here and never signed.
    const decoded = jwt.verify(token, getJwtSecret(), accessTokenVerifyOptions()) as DecodedToken;

    // api-jwt-auth spec: "Pre-deploy JWT without typ claim is rejected" —
    // required in exactly this one place (design.md D3). A validly-signed,
    // unexpired token that lacks `typ: 'access'` (pre-deploy JWTs, or a
    // refresh-typed value) is rejected, making the deploy cutover
    // deterministic and testable rather than hoped-for.
    if (decoded.typ !== 'access') {
      return res.status(401).json({ error: 'Token de autenticación inválido o expirado' });
    }

    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token de autenticación inválido o expirado' });
  }
};

// The principal always comes from `req.user`, set by apiAuthMiddleware from
// the JWT cookie. This API has exactly one authentication path — there is no
// server-side session store to fall back to.
export const requireRoles = (...roles: Role[]) => (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const principal = req.user;

  if (!principal) {
    return res.status(401).json({ error: 'Autenticación requerida' });
  }

  if (!roles.includes(principal.idRole as Role)) {
    return res.status(403).json({ error: 'Acceso restringido' });
  }

  next();
};

export const adminGuard = requireRoles(Role.ADMIN);
export const buyerGuard = requireRoles(Role.USER);

/**
 * Optional buyer session binder for public intake endpoints that also support
 * authenticated buyers (`POST /api/custom-commission-requests`). Only attaches
 * `req.user` when the request carries BOTH a valid `Role.USER` access JWT AND a
 * matching signed double-submit CSRF token — preventing cross-site CSRF from
 * injecting requests into a victim's buyer history while never blocking
 * anonymous submissions when cookies are absent or expired.
 */
export const optionalBuyerAuthMiddleware = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const token = req.cookies?.[AUTH_COOKIE];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret(), accessTokenVerifyOptions()) as DecodedToken;
    if (
      decoded.typ === 'access' &&
      decoded.idRole === Role.USER &&
      Number.isSafeInteger(decoded.userId) &&
      decoded.userId > 0 &&
      hasValidCsrfForUser(req, decoded.userId)
    ) {
      req.user = decoded;
    }
  } catch {
    // Expired or invalid cookies on public intake fall through as anonymous.
  }

  next();
};
