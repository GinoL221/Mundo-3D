import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

// Per-account companion to loginLimiter.ts. Keying only on the client IP
// fails in both directions at once: a distributed attacker gets a fresh
// budget per source address against a single account, while everyone behind
// one NAT/CGNAT address shares a single budget. This limiter closes the
// first half by counting failures per submitted account; the second half is
// closed by `skipSuccessfulRequests` on both limiters.
const windowMs = process.env.ACCOUNT_LOGIN_LIMIT_WINDOW
  ? parseInt(process.env.ACCOUNT_LOGIN_LIMIT_WINDOW, 10)
  : 15 * 60 * 1000; // 15 minutes

const max = process.env.ACCOUNT_LOGIN_LIMIT_MAX
  ? parseInt(process.env.ACCOUNT_LOGIN_LIMIT_MAX, 10)
  : 5;

// The route runs this ahead of loginValidation, which is where the address
// is lowercased, so the body value arrives with whatever casing and padding
// the client sent (normalizeLoginBody copies `Email` onto `email` but does
// not fold case). Without normalizing here, `A@Example.com` and
// `a@example.com` would occupy separate buckets and the limiter could be
// bypassed by pressing shift.
const submittedAccount = (req: Request): string => {
  const email: unknown = req.body?.email;
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

const limiter = rateLimit({
  windowMs,
  max,
  standardHeaders: true,
  legacyHeaders: false,
  // Keyed on whatever address was submitted, without ever checking that an
  // account exists: a limiter that throttled only real accounts would answer
  // "does this address exist?" through its own 429s.
  keyGenerator: submittedAccount,
  // No address means no account to protect, and the per-IP limiter still
  // covers the request. Keying on the empty string instead would collapse
  // every anonymous request into one shared bucket.
  skip: (req: Request) => submittedAccount(req) === '',
  // Only failed attempts are the threat being throttled, so a successful
  // login must not spend the account's budget.
  skipSuccessfulRequests: true,
  // Byte-identical to loginLimiter's body on purpose: a distinct message
  // would tell an attacker which of the two limiters fired, and this one
  // firing is itself a fact about the submitted account.
  message: {
    error: 'Demasiados intentos de inicio de sesión. Intente nuevamente en 15 minutos.',
  },
  statusCode: 429,
});

// Same JEST_WORKER_ID escape hatch as loginLimiter.ts — see its comment for
// why NODE_ENV alone is not a safe bypass condition.
const accountLoginLimiter = (req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'test' && process.env.JEST_WORKER_ID) {
    return next();
  }
  return limiter(req, res, next);
};

export default accountLoginLimiter;
