import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const windowMs = process.env.LOGIN_LIMIT_WINDOW
  ? parseInt(process.env.LOGIN_LIMIT_WINDOW, 10)
  : 15 * 60 * 1000; // 15 minutes

// The per-IP gate is what stops password spraying: spraying tries one
// password across many accounts, so it never trips the per-account counter
// in accountLoginLimiter.ts and this is the only limiter that sees it. It
// therefore has to stay meaningful. The old default of 5 was calibrated
// against a mix of successful and failed requests that no longer exists —
// only failures are counted now — so 10 failures per address per window
// caps spraying just as hard while leaving a shared-NAT office of typing
// humans well clear of it.
const max = process.env.LOGIN_LIMIT_MAX
  ? parseInt(process.env.LOGIN_LIMIT_MAX, 10)
  : 10;

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  // Failed attempts are the threat, so only they spend the budget. Counting
  // every request punished shared NAT/CGNAT clients for succeeding: one
  // office behind one address burned the whole allowance by logging in.
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
  },
  statusCode: 429,
});

// Only a real Jest process skips throttling. NODE_ENV alone is not enough:
// the e2e suite runs a real server with NODE_ENV=test, and a deploy
// misconfigured the same way would otherwise accept unlimited credential
// attempts. JEST_WORKER_ID is set by Jest and cannot come from a deploy
// config; e2e raises its limits through the *_LIMIT_MAX env vars instead.
const loginLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
    return next();
  }
  return limiter(req, res, next);
};

export default loginLimiter;
