import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

const windowMs = process.env.REGISTER_LIMIT_WINDOW
  ? parseInt(process.env.REGISTER_LIMIT_WINDOW, 10)
  : 15 * 60 * 1000; // 15 minutes

const max = process.env.REGISTER_LIMIT_MAX
  ? parseInt(process.env.REGISTER_LIMIT_MAX, 10)
  : 3;

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Demasiados intentos de registro. Intente nuevamente en 15 minutos.',
  },
  statusCode: 429,
});

// Only a real Jest process skips throttling. NODE_ENV alone is not enough:
// the e2e suite runs a real server with NODE_ENV=test, and a deploy
// misconfigured the same way would otherwise accept unlimited credential
// attempts. JEST_WORKER_ID is set by Jest and cannot come from a deploy
// config; e2e raises its limits through the *_LIMIT_MAX env vars instead.
const registerLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
    return next();
  }
  return limiter(req, res, next);
};

export default registerLimiter;
