import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Mirrors loginLimiter.ts (design.md D5) — the refresh route has no
// apiAuthMiddleware ahead of it, so this is the only throttle standing
// between a leaked/replayed refresh token and brute-force probing.
const windowMs = process.env.REFRESH_LIMIT_WINDOW
  ? parseInt(process.env.REFRESH_LIMIT_WINDOW, 10)
  : 15 * 60 * 1000; // 15 minutes

const max = process.env.REFRESH_LIMIT_MAX
  ? parseInt(process.env.REFRESH_LIMIT_MAX, 10)
  : 10;

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  // Same reasoning as loginLimiter.ts: the threat is failed probing of a
  // leaked/replayed token, so a successful rotation — the normal case, once
  // per access-token lifetime per tab — must not spend the budget.
  skipSuccessfulRequests: true,
  message: {
    error: 'Demasiados intentos de refresco de sesión. Intente nuevamente en 15 minutos.',
  },
  statusCode: 429,
});

// Same JEST_WORKER_ID escape hatch as loginLimiter.ts — see its comment for
// why NODE_ENV alone is not a safe bypass condition.
const refreshLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
    return next();
  }
  return limiter(req, res, next);
};

export default refreshLimiter;
