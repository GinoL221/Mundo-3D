import { NextFunction, Request, Response } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { readPositiveInt } from '../utils/readPositiveInt';

const acceptedResponse = (res: Response): void => {
  res.status(202).json({
    message: 'If the account is eligible, a confirmation email will be sent.',
  });
};

const max = readPositiveInt(process.env.RESEND_CONFIRMATION_IP_LIMIT_MAX, 5);

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? ''),
  handler: (_req: Request, res: Response) => acceptedResponse(res),
});

const resendConfirmationIpLimiter = (req: Request, res: Response, next: NextFunction) =>
  limiter(req, res, next);

export default resendConfirmationIpLimiter;
