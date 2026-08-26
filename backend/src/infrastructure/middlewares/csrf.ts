import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { CSRF_COOKIE } from '../security/cookieOptions';
import { verifyCsrfToken } from '../security/csrfToken';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const CSRF_HEADER = 'x-csrf-token';

// Pre-auth (no session exists yet) or CSRF-irrelevant (fail-safe: only
// removes authority) endpoints — design.md "Decision: CSRF ... Exemptions".
// Matched on req.path so the guard is safe to mount defensively; PR2 wires
// it onto the actual write routes and never mounts it on these three.
const EXEMPT_PATHS = new Set([
  '/login',
  '/register',
  '/logout',
  '/users/login',
  '/users/register',
  '/users/logout',
]);

/**
 * Signed double-submit CSRF check (design.md "Decision: CSRF = signed
 * double-submit cookie"). Must run AFTER `apiAuthMiddleware` — it verifies
 * the HMAC against the authenticated `req.user.userId` (primary) and
 * timing-safe-compares the header against the `m3d_csrf` cookie
 * (secondary). Safe methods and pre-auth routes bypass the check.
 */
export const csrfGuard = (req: Request, res: Response, next: NextFunction): void | Response => {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }

  if (EXEMPT_PATHS.has(req.path)) {
    return next();
  }

  const headerToken = req.headers[CSRF_HEADER];
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const userId = req.user?.userId;

  if (typeof headerToken !== 'string' || !cookieToken || userId === undefined) {
    return res.status(403).json({ error: 'CSRF token inválido' });
  }

  if (!verifyCsrfToken(headerToken, userId)) {
    return res.status(403).json({ error: 'CSRF token inválido' });
  }

  if (!timingSafeStringEqual(headerToken, cookieToken)) {
    return res.status(403).json({ error: 'CSRF token inválido' });
  }

  next();
};

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufA, bufB);
}
