import { Request, Response, NextFunction } from 'express';

const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

// `POST /api/orders` requires a client-generated `Idempotency-Key` header
// (order-checkout spec, "Idempotency Key on Checkout"). Unlike the other
// validators in this folder (express-validator chains consumed by the shared
// `handleValidationErrors`), this check must emit the exact `{ error, code }`
// shape from design.md's controller error-map table
// (`IDEMPOTENCY_KEY_REQUIRED`) so the client can branch on `code`
// programmatically — a plain express-validator body-shape (`{ errors: [...] }`)
// would not carry that `code` field. It is deliberately a standalone
// middleware, not an express-validator chain, and short-circuits the request
// itself rather than deferring to `handleValidationErrors`.
export const orderCreateValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const key = req.headers[IDEMPOTENCY_KEY_HEADER];

  if (typeof key !== 'string' || key.trim() === '') {
    return res.status(400).json({
      error: 'Falta el header Idempotency-Key',
      code: 'IDEMPOTENCY_KEY_REQUIRED',
    });
  }

  next();
};
