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

const registerLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test') {
    return next();
  }
  return limiter(req, res, next);
};

export default registerLimiter;
