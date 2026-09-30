import { Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const max = process.env.CUSTOM_COMMISSION_REQUEST_LIMIT_MAX
  ? parseInt(process.env.CUSTOM_COMMISSION_REQUEST_LIMIT_MAX, 10)
  : 5;

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? ''),
  handler: (_req: Request, res: Response) => {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
  },
});

export default limiter;
