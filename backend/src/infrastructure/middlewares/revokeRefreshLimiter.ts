import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// The refresh-token revocation endpoint always returns 204 while performing
// a database lookup and update per request when a token is present. Unlike
// /users/refresh (where successful rotations are normal and must not spend the
// budget), revocation must count every request (skipSuccessfulRequests: false)
// to throttle database lookups.
//
// The default ceiling is set to 100 requests per 15-minute window per IP.
// A low ceiling (e.g. 10) risks accidental exhaustion behind shared NATs
// (offices, dorms) or noisy clients, silently dropping revocation since the
// frontend swallows 429s. 100 requests / 15 min makes accidental exhaustion
// implausible for legitimate users while keeping the database-lookup throttle
// meaningful against abusive flooding.
const windowMs = process.env.REVOKE_REFRESH_LIMIT_WINDOW
  ? parseInt(process.env.REVOKE_REFRESH_LIMIT_WINDOW, 10)
  : 15 * 60 * 1000;

const max = process.env.REVOKE_REFRESH_LIMIT_MAX
  ? parseInt(process.env.REVOKE_REFRESH_LIMIT_MAX, 10)
  : 100;

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: {
    error: 'Demasiados intentos de revocación de sesión. Intente nuevamente en 15 minutos.',
  },
  statusCode: 429,
});

// No JEST_WORKER_ID bypass: the revocation endpoint is bounded by default
// and must remain throttled in tests so budget consumption can be verified.
// No other test suites depend on unlimited revoke calls.
const revokeRefreshLimiter = (req: Request, res: Response, next: NextFunction) => {
  return limiter(req, res, next);
};

export default revokeRefreshLimiter;
