import { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Invalid email confirmation token' });
  },
});

const emailConfirmationAttemptLimiter = (req: Request, res: Response, next: NextFunction) =>
  limiter(req, res, next);

export default emailConfirmationAttemptLimiter;
