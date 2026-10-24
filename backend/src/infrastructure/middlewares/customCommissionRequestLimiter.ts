import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const customCommissionRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
  handler: (_req, res) => res.status(429).json({ error: 'Too many requests. Please try again later.' }),
});

export default customCommissionRequestLimiter;
